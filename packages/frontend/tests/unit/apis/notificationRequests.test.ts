import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server.js';
import {
	getNotificationSettings,
	updateNotificationPreference,
} from '../../../src/apis/userRequests.js';
import { verifyEmailToken, resendVerificationEmail } from '../../../src/apis/authRequests.js';

const API_URL = 'http://localhost:3000';

describe('Notification API Requests', () => {
	describe('getNotificationSettings', () => {
		it('returns success with notification settings', async () => {
			const result = await getNotificationSettings();
			expect(result.success).toBe(true);
			expect(result.data).toHaveProperty('preferences');
			expect(result.data).toHaveProperty('emailVerified');
			expect(result.data).not.toHaveProperty('ntfyServerUrl');
		});

		it('returns error on server failure', async () => {
			server.use(
				http.get(`${API_URL}/api/user/notifications/preferences`, () => {
					return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
				})
			);
			const result = await getNotificationSettings();
			expect(result.success).toBe(false);
			expect(result.error).toBe('Unauthorized');
		});

		it('returns error on network failure', async () => {
			server.use(
				http.get(`${API_URL}/api/user/notifications/preferences`, () => HttpResponse.error())
			);
			const result = await getNotificationSettings();
			expect(result.success).toBe(false);
		});
	});

	describe('updateNotificationPreference', () => {
		it('returns success on valid update', async () => {
			const result = await updateNotificationPreference({
				notificationType: 'games_ready',
				channel: 'email',
				enabled: false,
			});
			expect(result.success).toBe(true);
		});

		it('returns error on 4xx response', async () => {
			server.use(
				http.patch(`${API_URL}/api/user/notifications/preferences`, () => {
					return HttpResponse.json({ error: 'Bad request' }, { status: 400 });
				})
			);
			const result = await updateNotificationPreference({
				notificationType: 'games_ready',
				channel: 'email',
				enabled: true,
			});
			expect(result.success).toBe(false);
		});
	});

	describe('verifyEmailToken', () => {
		it('returns success for valid token', async () => {
			const result = await verifyEmailToken('valid-token');
			expect(result.success).toBe(true);
		});

		it('returns error on 400 response', async () => {
			server.use(
				http.get(`${API_URL}/api/auth/verify-email`, () => {
					return HttpResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 });
				})
			);
			const result = await verifyEmailToken('bad-token');
			expect(result.success).toBe(false);
		});
	});

	describe('resendVerificationEmail', () => {
		it('returns success when email is sent', async () => {
			const result = await resendVerificationEmail();
			expect(result.success).toBe(true);
		});

		it('returns error on 401 response', async () => {
			server.use(
				http.post(`${API_URL}/api/auth/resend-verification`, () => {
					return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
				})
			);
			const result = await resendVerificationEmail();
			expect(result.success).toBe(false);
		});
	});
});
