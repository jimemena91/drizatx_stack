import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { QueueEventsService } from './queue-events.service';

@Global()
@Module({
  imports: [RealtimeModule, TypeOrmModule.forFeature([Ticket])],
  providers: [QueueEventsService],
  exports: [QueueEventsService],
})
export class QueueEventsModule {}
