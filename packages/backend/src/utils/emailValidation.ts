/**
 * Email validation utility
 */

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates email format using a simple but effective regex pattern
 * Checks for basic structure: localpart@domain.tld
 */
export function validateEmail(email: string): EmailValidationResult {
  // Basic email regex - checks for: text@text.text
  // Not RFC 5322 compliant (overly complex), but covers 99% of valid emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      error: 'Email is required',
    };
  }

  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: 'Invalid email format',
    };
  }

  // Check length constraints (max 254 chars per RFC 5321)
  if (email.length > 254) {
    return {
      valid: false,
      error: 'Email is too long',
    };
  }

  return { valid: true };
}
