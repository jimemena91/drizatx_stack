import { Module } from '@nestjs/common';

import { SystemSettingsModule } from '../system-settings/system-settings.module';

import { TerminalController } from './terminal.controller';
import { TerminalService } from './terminal.service';

@Module({
  imports: [SystemSettingsModule],
  controllers: [TerminalController],
  providers: [TerminalService],
})
export class TerminalModule {}
