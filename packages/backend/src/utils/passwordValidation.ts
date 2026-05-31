/**
 * Simple password validation for non-critical data
 */

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates password meets minimum requirements:
 * - At least 8 characters
 * - At most 128 characters (upper bound to prevent DoS via excessively long inputs)
 */
export function validatePassword(password: string): PasswordValidationResult {
  const MIN_LENGTH = 8;
  const MAX_LENGTH = 128;

  if (password.length < MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_LENGTH} characters long`,
    };
  }

  if (password.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must be ${MAX_LENGTH} characters or fewer`,
    };
  }

  return { valid: true };
}
