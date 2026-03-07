import { describe, it, expect, vi, afterEach } from 'vitest';

// vi.hoisted() variables are accessible inside vi.mock() factories
const mockEmailsSend = vi.hoisted(() => vi.fn().mockResolvedValue({ data: {}, error: null }));

vi.mock('../../../src/utils/envVars.js', async importOriginal => {
	const actual = await importOriginal<typeof import('../../../src/utils/envVars.js')>();
	return {
		...actual,
		notificationFromEmail: 'from@example.com',
		resendApiKey: 'test-api-key',
		notificationsEnabled: true,
		skipEmailSend: false,
	};
});

vi.mock('resend', () => {
	class ResendMock {
		emails = { send: mockEmailsSend };
	}
	return { Resend: ResendMock };
});

import { sendEmail } from '../../../src/notifications/emailSender.js';
import { sendNtfyNotification } from '../../../src/notifications/ntfySender.js';

describe('emailSender', () => {
	it('calls resend.emails.send with correct parameters and returns true', async () => {
		mockEmailsSend.mockResolvedValue({ data: {}, error: null });
		const result = await sendEmail({
			to: 'user@example.com',
			subject: 'Test subject',
			htmlBody: '<p>Hello</p>',
			textBody: 'Hello',
		});
		expect(result).toBe(true);
		expect(mockEmailsSend).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'user@example.com',
				subject: 'Test subject',
				html: '<p>Hello</p>',
				text: 'Hello',
			})
		);
	});
});

describe('ntfySender', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('POSTs to the correct URL and returns true on success', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
		const result = await sendNtfyNotification({
			ntfyServerUrl: 'https://ntfy.sh',
			userId: 42,
			title: 'Test',
			message: 'Hello',
		});
		expect(result).toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			'https://ntfy.sh/cfb-pickem-42',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('returns false on network error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
		const result = await sendNtfyNotification({
			ntfyServerUrl: 'https://ntfy.sh',
			userId: 1,
			title: 'Test',
			message: 'Hello',
		});
		expect(result).toBe(false);
	});

	it('returns false when server responds with non-OK status', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
		const result = await sendNtfyNotification({
			ntfyServerUrl: 'https://ntfy.sh',
			userId: 1,
			title: 'Test',
			message: 'Hello',
		});
		expect(result).toBe(false);
	});
});
