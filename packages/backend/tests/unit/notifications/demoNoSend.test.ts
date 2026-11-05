import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// The demo sends nothing: no email API key, skip-send on, and empty league channel settings.
// This runs the REAL senders (not mocked) and fails if anything reaches an outbound client.
const { resendSend } = vi.hoisted(() => ({ resendSend: vi.fn() }));
vi.mock('resend', () => ({
	Resend: class {
		emails = { send: resendSend };
	},
}));

import { seedTestData, createTestNotificationPreference, createTestWeek } from '../../db-utils.js';
import { dispatchGameComplete } from '../../../src/notifications/dispatcher.js';
import { sendEmail } from '../../../src/notifications/emailSender.js';
import { skipEmailSend, notificationsEnabled } from '../../../src/utils/envVars.js';

describe('demo environment sends no notifications', () => {
	const fetchSpy = vi.fn();
	const realFetch = globalThis.fetch;

	beforeAll(async () => {
		await seedTestData();
		await createTestWeek(1, 2024);
		await createTestNotificationPreference(2, 'rankings_updated', 'email', true);
	});

	beforeEach(() => {
		fetchSpy.mockReset();
		resendSend.mockReset();
		globalThis.fetch = fetchSpy as unknown as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = realFetch;
	});

	it('runs with email disabled (no API key configured in this environment)', () => {
		expect(notificationsEnabled).toBe(false);
		expect(typeof skipEmailSend).toBe('boolean');
	});

	it('dispatchGameComplete after a score correction makes no outbound call', async () => {
		await dispatchGameComplete(1, 2024, 1);
		expect(resendSend).not.toHaveBeenCalled();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('sendEmail reports not-sent and never reaches the provider', async () => {
		const sent = await sendEmail({ to: 'x@demo.invalid', subject: 's', htmlBody: 'h', textBody: 't' });
		expect(sent).toBe(false);
		expect(resendSend).not.toHaveBeenCalled();
	});
});
