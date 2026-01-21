/**
 * Port for verification service (phone and email).
 * This interface abstracts external verification providers (e.g., Twilio Verify).
 * Domain layer depends on this abstraction, not on concrete implementations.
 */
export interface VerificationService {
  /**
   * Request phone verification.
   * Sends OTP to the phone number via SMS.
   * @param phone - Phone number in E.164 format
   * @returns Verification session ID (for confirming later)
   */
  requestPhoneVerification(phone: string): Promise<string>;

  /**
   * Confirm phone verification.
   * Validates the OTP code.
   * @param phone - Phone number in E.164 format
   * @param code - OTP code entered by user
   * @returns true if verification successful, false otherwise
   */
  confirmPhoneVerification(phone: string, code: string): Promise<boolean>;

  /**
   * Request email verification.
   * Sends OTP to the email address.
   * @param email - Email address
   * @returns Verification session ID (for confirming later)
   */
  requestEmailVerification(email: string): Promise<string>;

  /**
   * Confirm email verification.
   * Validates the OTP code.
   * @param email - Email address
   * @param code - OTP code entered by user
   * @returns true if verification successful, false otherwise
   */
  confirmEmailVerification(email: string, code: string): Promise<boolean>;
}

// Token for dependency injection
export const VERIFICATION_SERVICE = Symbol('VerificationService');

