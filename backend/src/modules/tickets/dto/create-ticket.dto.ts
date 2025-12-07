import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ description: 'ID del servicio', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  serviceId?: number;

  @ApiProperty({ description: 'Teléfono móvil', example: '+5491123456789', required: false })
  @IsOptional()
  @IsString()
  mobilePhone?: string;

  @ApiProperty({
    description: 'Prioridad (1-6, donde 6 es la más urgente)',
    example: 6,
    minimum: 1,
    maximum: 6,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(6)
  priority?: number;

  @ApiProperty({ description: 'ID del cliente', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  clientId?: number;
}
