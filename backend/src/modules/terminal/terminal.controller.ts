import { Body, Controller, Post } from '@nestjs/common'
import { PrintTicketDto } from './dto/print-ticket.dto'
import { TerminalService } from './terminal.service'

type PrintTicketResponse = { success: true }

@Controller('terminal')
export class TerminalController {
  constructor(private readonly terminalService: TerminalService) {}

  @Post('print')
  async printTicket(@Body() payload: PrintTicketDto): Promise<PrintTicketResponse> {
    await this.terminalService.sendTicketToPrinter(payload)
    return { success: true }
  }
}
