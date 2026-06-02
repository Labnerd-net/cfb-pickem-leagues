import { describe, it, expect, vi, afterEach } from 'vitest';

// vi.hoisted() variables are accessible inside vi.mock() factories
const mockResendSend = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }));

vi.mock('../../../src/utils/envVars.js', async importOriginal => {
	const actual = await importOriginal<typeof import('../../../src/utils/envVars.js')>();
	return {
		...actual,
		resendApiKey: 'test-api-key',
		notificationFromEmail: 'from@example.com',
		notificationsEnabled: true,
		skipEmailSend: false,
	};
});

vi.mock('resend', () => ({
	Resend: vi.fn(function () {
		return { emails: { send: mockResendSend } };
	}),
}));

import { sendEmail } from '../../../src/notifications/emailSender.js';
import { sendNtfyNotification } from '../../../src/notifications/ntfySender.js';
import { sendTelegramNotification } from '../../../src/notifications/telegramSender.js';
import { sendDiscordNotification } from '../../../src/notifications/discordSender.js';

describe('emailSender', () => {
	it('calls resend.emails.send with correct parameters and returns true', async () => {
		mockResendSend.mockResolvedValue({ data: { id: 'test-id' }, error: null });
		const result = await sendEmail({
			to: 'user@example.com',
			subject: 'Test subject',
			htmlBody: '<p>Hello</p>',
			textBody: 'Hello',
		});
		expect(result).toBe(true);
		expect(mockResendSend).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'user@example.com',
				subject: 'Test subject',
				html: '<p>Hello</p>',
				text: 'Hello',
			})
		);
	});

	it('returns false when Resend returns an error', async () => {
		mockResendSend.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'Invalid email' } });
		const result = await sendEmail({
			to: 'bad@example.com',
			subject: 'Test',
			htmlBody: '<p>Hi</p>',
			textBody: 'Hi',
		});
		expect(result).toBe(false);
	});
});

describe('ntfySender', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('POSTs to the configured topic URL and returns true on success', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
		const result = await sendNtfyNotification({ topicUrl: 'https://ntfy.sh/cfb-pickem', title: 'Test', message: 'Hello' });
		expect(result).toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			'https://ntfy.sh/cfb-pickem',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('returns false when topicUrl is empty', async () => {
		const result = await sendNtfyNotification({ topicUrl: '', title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});

	it('returns false on network error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
		const result = await sendNtfyNotification({ topicUrl: 'https://ntfy.sh/test', title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});

	it('returns false when server responds with non-OK status', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
		const result = await sendNtfyNotification({ topicUrl: 'https://ntfy.sh/test', title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});
});

describe('telegramSender', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns true on successful API response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
		const result = await sendTelegramNotification({ botToken: 'test-bot-token', chatId: '-100123456', title: 'Test', message: 'Hello' });
		expect(result).toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			'https://api.telegram.org/bottest-bot-token/sendMessage',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('returns false when botToken is empty', async () => {
		const result = await sendTelegramNotification({ botToken: '', chatId: '-100123456', title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});

	it('returns false on non-OK response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' }));
		const result = await sendTelegramNotification({ botToken: 'test-bot-token', chatId: '-100123456', title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});

	it('returns false on network error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
		const result = await sendTelegramNotification({ botToken: 'test-bot-token', chatId: '-100123456', title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});
});

describe('discordSender', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns true on successful webhook response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
		const result = await sendDiscordNotification({ webhookUrl: 'https://discord.com/api/webhooks/test', title: 'Test', message: 'Hello' });
		expect(result).toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			'https://discord.com/api/webhooks/test',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('returns false when webhookUrl is empty', async () => {
		const result = await sendDiscordNotification({ webhookUrl: '', title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});

	it('returns false on non-OK response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' }));
		const result = await sendDiscordNotification({ webhookUrl: 'https://discord.com/api/webhooks/test', title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});

	it('returns false on network error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
		const result = await sendDiscordNotification({ webhookUrl: 'https://discord.com/api/webhooks/test', title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});
});
