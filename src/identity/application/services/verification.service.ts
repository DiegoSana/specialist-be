import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  VerificationService as VerificationServicePort,
  VERIFICATION_SERVICE,
} from '../../domain/ports/verification.service';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { UserEntity } from '../../domain/entities/user.entity';
import { Phone } from '../../domain/value-objects/phone.vo';
import { Email } from '../../domain/value-objects/email.vo';

/**
 * Application service for phone and email verification.
 * Orchestrates verification flow using Twilio Verify.
 */
@Injectable()
export class VerificationService {
  constructor(
    @Inject(VERIFICATION_SERVICE)
    private readonly verificationService: VerificationServicePort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Request phone verification.
   * Validates phone format and sends OTP via Twilio.
   */
  async requestPhoneVerification(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phone) {
      throw new BadRequestException('User does not have a phone number');
    }

    if (user.phoneVerified) {
      throw new BadRequestException('Phone is already verified');
    }

    // Validate phone format (E.164)
    try {
      const phone = new Phone(user.phone);
      await this.verificationService.requestPhoneVerification(phone.getValue());
    } catch (error: any) {
      throw new BadRequestException(
        error.message || 'Invalid phone number format',
      );
    }
  }

  /**
   * Confirm phone verification.
   * Validates OTP and marks phone as verified if successful.
   */
  async confirmPhoneVerification(
    userId: string,
    code: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phone) {
      throw new BadRequestException('User does not have a phone number');
    }

    if (user.phoneVerified) {
      throw new BadRequestException('Phone is already verified');
    }

    // Validate phone format
    let phone: Phone;
    try {
      phone = new Phone(user.phone);
    } catch (error: any) {
      throw new BadRequestException(
        error.message || 'Invalid phone number format',
      );
    }

    // Verify code with Twilio
    const isValid = await this.verificationService.confirmPhoneVerification(
      phone.getValue(),
      code,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Mark phone as verified
    const updatedUser = user.withPhoneVerified();
    await this.userRepository.save(updatedUser);
  }

  /**
   * Request email verification.
   * Validates email format and sends OTP via Twilio.
   */
  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Validate email format
    try {
      const email = new Email(user.email);
      await this.verificationService.requestEmailVerification(
        email.getValue(),
      );
    } catch (error: any) {
      throw new BadRequestException(
        error.message || 'Invalid email format',
      );
    }
  }

  /**
   * Confirm email verification.
   * Validates OTP and marks email as verified if successful.
   */
  async confirmEmailVerification(
    userId: string,
    code: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Validate email format
    let email: Email;
    try {
      email = new Email(user.email);
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Invalid email format');
    }

    // Verify code with Twilio
    const isValid = await this.verificationService.confirmEmailVerification(
      email.getValue(),
      code,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Mark email as verified
    const updatedUser = user.withEmailVerified();
    await this.userRepository.save(updatedUser);
  }
}

