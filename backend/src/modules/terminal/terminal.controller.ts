import { Body, Controller, Post } from '@nestjs/common'
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrintTicketDto } from './dto/print-ticket.dto'
import { TerminalService } from './terminal.service'
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';

type PrintTicketResponse = { success: true }

@Controller('terminal')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TerminalController {
  constructor(private readonly terminalService: TerminalService) {}

  @Post('print')
  @Roles(Role.OPERATOR, Role.ADMIN)
  async printTicket(@Body() payload: PrintTicketDto): Promise<PrintTicketResponse> {
    await this.terminalService.sendTicketToPrinter(payload)
    return { success: true }
  }
}
