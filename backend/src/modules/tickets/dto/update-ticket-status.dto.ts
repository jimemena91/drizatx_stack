import { IsEnum, IsOptional, IsNumber } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"
import { Status } from "../../../common/enums/status.enum"

export class UpdateTicketStatusDto {
  @ApiProperty({ description: "Nuevo estado del ticket", enum: Status })
  @IsEnum(Status)
  status: Status

  @ApiProperty({ description: "ID del operador asignado", required: false })
  @IsOptional()
  @IsNumber()
  operatorId?: number
}
