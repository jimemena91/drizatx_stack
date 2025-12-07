import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../../entities/client.entity';
import { Ticket } from '../../entities/ticket.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { ClientsPublicController } from './clients-public.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Client, Ticket])], // 👈 CLAVE
  providers: [ClientsService, PermissionsGuard],
  controllers: [ClientsController, ClientsPublicController],
  exports: [ClientsService, TypeOrmModule],      // si lo usan otros módulos
})
export class ClientsModule {}
