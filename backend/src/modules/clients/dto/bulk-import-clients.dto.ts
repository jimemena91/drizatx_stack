import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from "class-validator";

export class BulkImportClientRowDto {
  @ApiProperty({ description: "DNI del cliente", example: "12345678" })
  @IsString()
  @Length(1, 20)
  dni: string;

  @ApiProperty({ description: "Nombre completo", example: "Juan Pérez" })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ description: "Email del cliente", example: "juan@email.com", required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: "Teléfono del cliente", example: "+5491123456789", required: false })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  phone?: string;

  @ApiProperty({ description: "Cliente VIP", example: false, default: false, required: false })
  @IsOptional()
  @IsBoolean()
  vip?: boolean;
}

export class BulkImportClientsDto {
  @ApiProperty({ type: [BulkImportClientRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => BulkImportClientRowDto)
  clients: BulkImportClientRowDto[];
}
