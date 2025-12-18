import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { ContactService } from '../application/contact.service';
import { CreateContactDto } from '../application/dto/create-contact.dto';

@ApiTags('Contact')
@Controller('contact')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a contact request' })
  @ApiResponse({ status: 201, description: 'Contact request created successfully' })
  async createContact(@CurrentUser() user: UserEntity, @Body() createDto: CreateContactDto) {
    return this.contactService.create(user.id, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get my contact requests' })
  @ApiResponse({ status: 200, description: 'List of contact requests' })
  async getMyContacts(@CurrentUser() user: UserEntity) {
    return this.contactService.findByUserId(user.id);
  }
}

