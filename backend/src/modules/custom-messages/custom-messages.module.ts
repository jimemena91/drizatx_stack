import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomMessagesController } from './custom-messages.controller';
import { CustomMessagesService } from './custom-messages.service';
import { CustomMessage } from '../../entities/custom-message.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([CustomMessage])],
  controllers: [CustomMessagesController],
  providers: [CustomMessagesService, PermissionsGuard],
  exports: [CustomMessagesService],
})
export class CustomMessagesModule {}
