/**
 * Simple password validation for non-critical data
 */

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates password meets minimum requirements:
 * - At least 8 characters long
 * - At most 72 characters (bcrypt silently truncates inputs above 72 bytes,
 *   producing a weaker hash with no error; existing users with longer passwords
 *   were hashed at 72 bytes and are unaffected, but they will need to reset if
 *   they exceed this limit going forward)
 */
export function validatePassword(password: string): PasswordValidationResult {
  const MIN_LENGTH = 8;
  const MAX_LENGTH = 72;

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
