import { describe, it, expect, vi, afterEach } from 'vitest';

// vi.hoisted() variables are accessible inside vi.mock() factories
const mockSendMail = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock('../../../src/utils/envVars.js', async importOriginal => {
	const actual = await importOriginal<typeof import('../../../src/utils/envVars.js')>();
	return {
		...actual,
		notificationFromEmail: 'from@example.com',
		notificationsEnabled: true,
		skipEmailSend: false,
		ntfyTopicUrl: 'https://ntfy.sh/cfb-pickem',
		ntfyEnabled: true,
		telegramBotToken: 'test-bot-token',
		telegramChatId: '-100123456',
		telegramEnabled: true,
		discordWebhookUrl: 'https://discord.com/api/webhooks/test',
		discordEnabled: true,
	};
});

vi.mock('nodemailer', () => ({
	default: {
		createTransport: vi.fn().mockReturnValue({
			sendMail: mockSendMail,
		}),
	},
}));

import { sendEmail } from '../../../src/notifications/emailSender.js';
import { sendNtfyNotification } from '../../../src/notifications/ntfySender.js';
import { sendTelegramNotification } from '../../../src/notifications/telegramSender.js';
import { sendDiscordNotification } from '../../../src/notifications/discordSender.js';

describe('emailSender', () => {
	it('calls nodemailer sendMail with correct parameters and returns true', async () => {
		mockSendMail.mockResolvedValue({});
		const result = await sendEmail({
			to: 'user@example.com',
			subject: 'Test subject',
			htmlBody: '<p>Hello</p>',
			textBody: 'Hello',
		});
		expect(result).toBe(true);
		expect(mockSendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'user@example.com',
				subject: 'Test subject',
				html: '<p>Hello</p>',
				text: 'Hello',
			})
		);
	});

	it('creates the nodemailer transporter only once (singleton), not per sendEmail call', async () => {
		const nodemailer = await import('nodemailer');
		const createTransport = vi.mocked(nodemailer.default.createTransport);

		await sendEmail({ to: 'a@example.com', subject: 'S1', htmlBody: '<p>1</p>', textBody: '1' });
		await sendEmail({ to: 'b@example.com', subject: 'S2', htmlBody: '<p>2</p>', textBody: '2' });

		// createTransport is called at module load, never inside sendEmail
		expect(createTransport).toHaveBeenCalledTimes(1);
	});
});

describe('ntfySender', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('POSTs to the configured topic URL and returns true on success', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
		const result = await sendNtfyNotification({ title: 'Test', message: 'Hello' });
		expect(result).toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			'https://ntfy.sh/cfb-pickem',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('returns false on network error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
		const result = await sendNtfyNotification({ title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});

	it('returns false when server responds with non-OK status', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
		const result = await sendNtfyNotification({ title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});
});

describe('telegramSender', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns true on successful API response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
		const result = await sendTelegramNotification({ title: 'Test', message: 'Hello' });
		expect(result).toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			'https://api.telegram.org/bottest-bot-token/sendMessage',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('returns false on non-OK response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' }));
		const result = await sendTelegramNotification({ title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});

	it('returns false on network error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
		const result = await sendTelegramNotification({ title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});
});

describe('discordSender', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns true on successful webhook response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
		const result = await sendDiscordNotification({ title: 'Test', message: 'Hello' });
		expect(result).toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			'https://discord.com/api/webhooks/test',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('returns false on non-OK response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' }));
		const result = await sendDiscordNotification({ title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});

	it('returns false on network error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
		const result = await sendDiscordNotification({ title: 'Test', message: 'Hello' });
		expect(result).toBe(false);
	});
});
