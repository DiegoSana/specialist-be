import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { VerificationService } from '../application/services/verification.service';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../domain/entities/user.entity';

/**
 * DTO for verification code confirmation
 */
class ConfirmVerificationDto {
  @ApiProperty({
    description: 'Verification code sent to phone/email',
    example: '123456',
    minLength: 4,
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(10)
  code: string;
}

/**
 * Response DTO for verification requests
 */
class VerificationRequestResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Verification code sent successfully',
  })
  message: string;
}

/**
 * Response DTO for verification confirmations
 */
class VerificationConfirmResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Phone verified successfully',
  })
  message: string;
}

@ApiTags('Verification')
@ApiBearerAuth()
@Controller('identity/verification')
@UseGuards(JwtAuthGuard)
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
  ) {}

  @Post('phone/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request phone verification',
    description:
      'Sends an OTP code to the user\'s phone number via SMS. ' +
      'The phone number must be in E.164 format (e.g., +5492944123456).',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
    type: VerificationRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid phone number format, user has no phone, or phone is already verified',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async requestPhoneVerification(
    @CurrentUser() user: UserEntity,
  ): Promise<VerificationRequestResponseDto> {
    await this.verificationService.requestPhoneVerification(user.id);
    return { message: 'Verification code sent successfully' };
  }

  @Post('phone/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm phone verification',
    description:
      'Validates the OTP code and marks the phone as verified if successful.',
  })
  @ApiResponse({
    status: 200,
    description: 'Phone verified successfully',
    type: VerificationConfirmResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired code, or phone already verified',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async confirmPhoneVerification(
    @CurrentUser() user: UserEntity,
    @Body() dto: ConfirmVerificationDto,
  ): Promise<VerificationConfirmResponseDto> {
    await this.verificationService.confirmPhoneVerification(user.id, dto.code);
    return { message: 'Phone verified successfully' };
  }

  @Post('email/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request email verification',
    description: 'Sends an OTP code to the user\'s email address.',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
    type: VerificationRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email format or email is already verified',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async requestEmailVerification(
    @CurrentUser() user: UserEntity,
  ): Promise<VerificationRequestResponseDto> {
    await this.verificationService.requestEmailVerification(user.id);
    return { message: 'Verification code sent successfully' };
  }

  @Post('email/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm email verification',
    description:
      'Validates the OTP code and marks the email as verified if successful.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    type: VerificationConfirmResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired code, or email already verified',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async confirmEmailVerification(
    @CurrentUser() user: UserEntity,
    @Body() dto: ConfirmVerificationDto,
  ): Promise<VerificationConfirmResponseDto> {
    await this.verificationService.confirmEmailVerification(user.id, dto.code);
    return { message: 'Email verified successfully' };
  }
}

