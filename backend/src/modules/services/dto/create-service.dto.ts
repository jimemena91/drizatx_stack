import { IsString, IsBoolean, IsNumber, IsOptional, Min, Max, Length } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class CreateServiceDto {
  @ApiProperty({ description: "Nombre del servicio", example: "Atención General" })
  @IsString()
  @Length(1, 100)
  name: string

  @ApiProperty({ description: "Icono que representa al servicio", example: "headset", required: false })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  icon?: string | null

  @ApiProperty({ description: "Prefijo para numeración", example: "A" })
  @IsString()
  @Length(1, 10)
  prefix: string

  @ApiProperty({ description: "Estado activo", example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean

  @ApiProperty({
    description: "Prioridad (1-6, donde 6 es la más urgente)",
    example: 6,
    minimum: 1,
    maximum: 6,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(6)
  priority?: number

  @ApiProperty({ description: "Tiempo estimado en minutos", example: 15, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  estimatedTime?: number

  @ApiProperty({ description: "Tiempo máximo de atención en minutos", example: 20, minimum: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttentionTime?: number | null
}
