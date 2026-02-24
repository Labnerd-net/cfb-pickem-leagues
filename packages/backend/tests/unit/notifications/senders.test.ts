import { describe, it, expect, vi, afterEach } from 'vitest';

// vi.hoisted() variables are accessible inside vi.mock() factories
const mockSend = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock('../../../src/utils/envVars.js', async importOriginal => {
	const actual = await importOriginal<typeof import('../../../src/utils/envVars.js')>();
	return {
		...actual,
		notificationFromEmail: 'from@example.com',
		awsRegion: 'us-east-1',
		notificationsEnabled: true,
		skipEmailSend: false,
	};
});

vi.mock('@aws-sdk/client-ses', () => {
	class SESClientMock {
		send = mockSend;
	}
	return {
		SESClient: SESClientMock,
		SendEmailCommand: vi.fn(function (input: unknown) { return input; }),
	};
});

import { sendEmail } from '../../../src/notifications/emailSender.js';
import { sendNtfyNotification } from '../../../src/notifications/ntfySender.js';
import { SendEmailCommand } from '@aws-sdk/client-ses';

describe('emailSender', () => {
	it('calls SendEmailCommand with correct parameters and returns true', async () => {
		mockSend.mockResolvedValue({});
		const result = await sendEmail({
			to: 'user@example.com',
			subject: 'Test subject',
			htmlBody: '<p>Hello</p>',
			textBody: 'Hello',
		});
		expect(result).toBe(true);
		expect(SendEmailCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				Destination: { ToAddresses: ['user@example.com'] },
				Message: expect.objectContaining({
					Subject: { Data: 'Test subject', Charset: 'UTF-8' },
				}),
			})
		);
		expect(mockSend).toHaveBeenCalled();
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
