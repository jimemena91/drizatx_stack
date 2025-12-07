// backend/src/modules/terminal/dto/print-ticket.dto.ts
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'

export class PrintTicketDto {
  @IsString()
  @IsNotEmpty()
  ticketNumber!: string

  @IsString()
  @IsNotEmpty()
  serviceName!: string

  @IsInt()
  @Min(1)
  ticketId!: number

  @IsInt()
  @Min(1)
  serviceId!: number

  @IsOptional()
  @IsString()
  clientName?: string
}
