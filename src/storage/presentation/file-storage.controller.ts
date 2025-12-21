import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { Public } from '../../shared/presentation/decorators/public.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { FileStorageService } from '../application/services/file-storage.service';
import { FileAccessGuard } from './guards/file-access.guard';
import { UploadFileDto } from '../application/dto/upload-file.dto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@ApiTags('Storage')
@Controller('storage')
export class FileStorageController {
  private readonly storagePath: string;

  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly configService: ConfigService,
  ) {
    this.storagePath = this.configService.get<string>(
      'STORAGE_LOCAL_PATH',
      './uploads',
    );
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        category: {
          type: 'string',
          enum: [
            'profile-picture',
            'project-image',
            'project-video',
            'request-photo',
          ],
        },
        requestId: {
          type: 'string',
          format: 'uuid',
        },
      },
    },
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a file' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadFileDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.fileStorageService.uploadFile(file, uploadDto, user.id);
  }

  @Get('public/:path(*)')
  @Public()
  @ApiOperation({ summary: 'Get public file' })
  @ApiResponse({ status: 200, description: 'File retrieved successfully' })
  async getPublicFile(@Param('path') filePath: string, @Res() res: Response) {
    const fullPath = path.join(this.storagePath, 'public', filePath);

    try {
      await fs.access(fullPath);
      return res.sendFile(path.resolve(fullPath));
    } catch {
      throw new NotFoundException('File not found');
    }
  }

  @Get('private/:path(*)')
  @UseGuards(JwtAuthGuard, FileAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get private file' })
  @ApiResponse({ status: 200, description: 'File retrieved successfully' })
  async getPrivateFile(@Param('path') filePath: string, @Res() res: Response) {
    const fullPath = path.join(this.storagePath, 'private', filePath);

    try {
      await fs.access(fullPath);
      return res.sendFile(path.resolve(fullPath));
    } catch {
      throw new NotFoundException('File not found');
    }
  }

  @Delete(':path(*)')
  @UseGuards(JwtAuthGuard, FileAccessGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file' })
  @ApiResponse({ status: 204, description: 'File deleted successfully' })
  async deleteFile(
    @Param('path') filePath: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.fileStorageService.deleteFile(
      filePath,
      user.id,
      user.isAdminUser(),
    );
  }
}
