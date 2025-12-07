import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsArray,
  IsString,
  Length,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  isDataURI,
  isURL,
} from 'class-validator';
import { IsArray as IsArrayValidator } from 'class-validator';

const MESSAGE_TYPES = ['info', 'warning', 'promotion', 'announcement'] as const;

@ValidatorConstraint({ name: 'isMediaUrl', async: false })
class IsMediaUrlConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    return (
      isURL(value, { protocols: ['http', 'https'], require_protocol: true }) ||
      isDataURI(value)
    );
  }

  defaultMessage(): string {
    return 'mediaUrl debe ser una URL válida';
  }
}

export class CreateCustomMessageDto {
  @ApiProperty({ description: 'Título del mensaje', example: 'Promoción de verano' })
  @IsString()
  @Length(1, 150)
  title: string;

  @ApiProperty({ description: 'Contenido del mensaje', example: '2x1 en servicios premium todo el mes.' })
  @IsString()
  @Length(1, 2000)
  content: string;

  @ApiProperty({ description: 'Tipo de mensaje', example: 'promotion', enum: MESSAGE_TYPES, required: false })
  @IsOptional()
  @IsString()
  @IsIn(MESSAGE_TYPES)
  type?: (typeof MESSAGE_TYPES)[number];

  @ApiProperty({ description: 'Indica si el mensaje está activo', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({
    description: 'Prioridad de despliegue (1-6, donde 6 es la más urgente)',
    example: 6,
    default: 1,
    minimum: 1,
    maximum: 6,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  priority?: number;

  @ApiProperty({ description: 'Fecha de inicio de vigencia', example: '2024-01-01T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiProperty({ description: 'Fecha de finalización de vigencia', example: '2024-02-01T23:59:59.000Z', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiProperty({ description: 'URL de un recurso multimedia', example: 'https://cdn.example.com/promo.jpg', required: false })
  @IsOptional()
  @IsString()
  @Validate(IsMediaUrlConstraint, { message: 'mediaUrl debe ser una URL válida' })
  mediaUrl?: string | null;

  @ApiProperty({ description: 'Tipo de recurso multimedia (imagen, video, etc.)', example: 'image/jpeg', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  mediaType?: string | null;

  @ApiProperty({
    description: 'Duración máxima de visualización en segundos',
    example: 30,
    required: false,
    minimum: 5,
    maximum: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  displayDurationSeconds?: number | null;

  @ApiProperty({
    description: 'Días de la semana en los que se muestra el mensaje',
    example: ['mon', 'tue', 'wed'],
    required: false,
  })
  @IsOptional()
  @IsArrayValidator()
  @ArrayNotEmpty()
  @IsIn(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], { each: true })
  activeDays?: string[] | null;
}

export class UpdateCustomMessageDto extends PartialType(CreateCustomMessageDto) {}
