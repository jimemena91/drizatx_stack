import { IsString, IsOptional, Length } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class CreateSystemSettingDto {
  @ApiProperty({ description: "Clave de configuración", example: "maxWaitTime" })
  @IsString()
  @Length(1, 100)
  key: string

  @ApiProperty({ description: "Valor de configuración", example: "60" })
  @IsString()
  value: string

  @ApiProperty({ description: "Descripción de la configuración", required: false })
  @IsOptional()
  @IsString()
  description?: string
}
