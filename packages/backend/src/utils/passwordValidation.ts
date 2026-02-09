/**
 * Simple password validation for non-critical data
 */

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates password meets minimum requirements:
 * - At least 6 characters long
 */
export function validatePassword(password: string): PasswordValidationResult {
  const MIN_LENGTH = 6;

  if (password.length < MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_LENGTH} characters long`,
    };
  }

  return { valid: true };
}
