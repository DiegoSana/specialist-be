import {
  Injectable,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { UpdateUserDto } from '../dto/update-user.dto';
// Cross-context dependency - using Service instead of Repository (DDD)
import { UserService } from '../../../identity/application/services/user.service';
import { UserEntity } from '../../../identity/domain/entities/user.entity';
import {
  ClientRepository,
  CLIENT_REPOSITORY,
} from '../../domain/repositories/client.repository';
import { ClientEntity } from '../../domain/entities/client.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class ClientService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
  ) {}

  async getProfile(userId: string): Promise<UserEntity> {
    // Include profiles so flags are correctly derived
    return this.userService.findByIdOrFail(userId, true);
  }

  async updateProfile(
    userId: string,
    updateDto: UpdateUserDto,
  ): Promise<UserEntity> {
    // Validate profilePictureUrl if provided
    if (
      updateDto.profilePictureUrl !== undefined &&
      updateDto.profilePictureUrl !== null &&
      updateDto.profilePictureUrl !== ''
    ) {
      try {
        new URL(updateDto.profilePictureUrl);
      } catch {
        throw new BadRequestException('profilePictureUrl must be a valid URL');
      }
    }

    return this.userService.update(userId, updateDto);
  }

  async activateClientProfile(userId: string): Promise<UserEntity> {
    // Check if user exists
    const user = await this.userService.findByIdOrFail(userId, true);

    // Check if client profile already exists
    if (user.hasClientProfile) {
      throw new ConflictException('Client profile already exists');
    }

    // Create client profile (aggregate completo)
    await this.clientRepository.save(
      ClientEntity.createForUser({
        id: randomUUID(),
        userId,
      }),
    );

    // Return updated user with client profile
    return this.userService.findByIdOrFail(userId, true);
  }
}
