// backend/src/modules/operators/dto/create-operator.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayUnique,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Role } from '../../../common/enums/role.enum';

export class CreateOperatorDto {
  @ApiProperty({ example: 'María García' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ example: 'admin', minLength: 3, maxLength: 50 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(3, 50)
  // opcional, endurecer username:
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'username inválido (solo letras, números, ., _, -)' })
  username!: string;

  @ApiProperty({ example: 'admin123', minLength: 6, maxLength: 100 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(6)
  @Length(6, 100)
  password!: string;

  @ApiProperty({ example: 'maria@empresa.com' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Supervisor', required: false })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 100)
  position?: string;

  @ApiProperty({ enum: Role, example: Role.OPERATOR, required: false })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({ enum: Role, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  roles?: Role[];

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  // Servicios a habilitar al crear (opcional)
  @ApiProperty({
    required: false,
    type: [Number],
    description: 'IDs de servicios a habilitar al crear el operador',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  serviceIds?: number[];
}
