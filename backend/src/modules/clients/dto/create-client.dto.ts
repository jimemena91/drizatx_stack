import { IsString, IsEmail, IsOptional, IsBoolean, Length } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class CreateClientDto {
  @ApiProperty({ description: "DNI del cliente", example: "12345678" })
  @IsString()
  @Length(1, 20)
  dni: string

  @ApiProperty({ description: "Nombre completo", example: "Juan Pérez" })
  @IsString()
  @Length(1, 100)
  name: string

  @ApiProperty({ description: "Email del cliente", example: "juan@email.com", required: false })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({ description: "Teléfono del cliente", example: "+5491123456789", required: false })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  phone?: string

  @ApiProperty({ description: "Cliente VIP", example: false, default: false })
  @IsOptional()
  @IsBoolean()
  vip?: boolean
}
