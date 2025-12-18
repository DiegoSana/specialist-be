import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ContactRepository, CONTACT_REPOSITORY } from '../domain/repositories/contact.repository';
import { ContactEntity } from '../domain/entities/contact.entity';
import { UserRepository, USER_REPOSITORY } from '../../identity/domain/repositories/user.repository';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contactRepository: ContactRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async create(fromUserId: string, createDto: CreateContactDto): Promise<ContactEntity> {
    const fromUser = await this.userRepository.findById(fromUserId);
    if (!fromUser) {
      throw new NotFoundException('User not found');
    }

    const toUser = await this.userRepository.findById(createDto.toUserId);
    if (!toUser) {
      throw new NotFoundException('Target user not found');
    }

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

