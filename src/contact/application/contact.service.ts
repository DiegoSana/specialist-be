import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ContactRepository, CONTACT_REPOSITORY } from '../domain/repositories/contact.repository';
import { ContactEntity } from '../domain/entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
// Cross-context dependency - using Service instead of Repository (DDD)
import { UserService } from '../../identity/application/services/user.service';

@Injectable()
export class ContactService {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contactRepository: ContactRepository,
    private readonly userService: UserService,
  ) {}

  async create(fromUserId: string, createDto: CreateContactDto): Promise<ContactEntity> {
    // Validate both users exist
    await this.userService.findByIdOrFail(fromUserId);
    await this.userService.findByIdOrFail(createDto.toUserId);

    if (fromUserId === createDto.toUserId) {
      throw new BadRequestException('Cannot contact yourself');
    }

    return this.contactRepository.create({
      fromUserId,
      toUserId: createDto.toUserId,
      contactType: createDto.contactType || 'whatsapp',
      message: createDto.message || null,
    });
  }

  async findByUserId(userId: string): Promise<ContactEntity[]> {
    return this.contactRepository.findByUserId(userId);
  }
}

