import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: '+5492944123456',
    description: 'Phone number is required',
  })
  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'El número de teléfono no es válido',
  })
  phone: string;

  @ApiProperty({
    example: false,
    required: false,
    description: 'If true, client profile will not be created automatically',
  })
  @IsOptional()
  @IsBoolean()
  isProfessional?: boolean;
}
