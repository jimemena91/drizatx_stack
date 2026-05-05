import { Module } from '@nestjs/common';
import { PrintModule } from '../print/print.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

import { TerminalController } from './terminal.controller';
import { TerminalService } from './terminal.service';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [SystemSettingsModule, PrintModule],
  controllers: [TerminalController],
  providers: [TerminalService, RolesGuard],
})
export class TerminalModule {}
