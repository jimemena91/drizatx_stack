import { Module } from '@nestjs/common';
import { DisplayPublicController } from './display-public.controller';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { CustomMessagesModule } from '../custom-messages/custom-messages.module';

@Module({
  imports: [SystemSettingsModule, CustomMessagesModule],
  controllers: [DisplayPublicController],
})
export class DisplayModule {}
