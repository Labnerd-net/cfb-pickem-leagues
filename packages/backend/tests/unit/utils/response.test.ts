import { describe, it, expect } from 'vitest';
import { ok, err } from '../../../src/utils/response.js';

describe('Response utilities', () => {
	describe('ok', () => {
		it('should return success response with data', () => {
			const data = { message: 'Success' };
			const result = ok(data);

			expect(result).toEqual({
				ok: true,
				data,
			});
		});

		it('should handle null data', () => {
			const result = ok(null);

			expect(result).toEqual({
				ok: true,
				data: null,
			});
		});
	});

	describe('err', () => {
		it('should return error response with message and default code', () => {
			const message = 'Something went wrong';
			const result = err(message);

			expect(result).toEqual({
				ok: false,
				error: message,
				code: 400,
			});
		});

		it('should return error response with custom code', () => {
			const message = 'Unauthorized';
			const code = 401;
			const result = err(message, code);

			expect(result).toEqual({
				ok: false,
				error: message,
				code: 401,
			});
		});
	});
});
