import { Controller, Get, Param } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Client } from '../../entities/client.entity';

function sanitizeClient(client: Client) {
  return {
    id: Number(client.id),
    dni: String(client.dni ?? ''),
    name: String(client.name ?? ''),
    email: client.email ?? null,
    phone: client.phone ?? null,
    vip: Boolean(client.vip),
    createdAt: client.createdAt instanceof Date ? client.createdAt.toISOString() : null,
    updatedAt: client.updatedAt instanceof Date ? client.updatedAt.toISOString() : null,
  };
}

@Controller('clients/public')
export class ClientsPublicController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('dni/:dni')
  async findByDni(@Param('dni') rawDni: string) {
    const dni = rawDni?.trim();
    if (!dni) {
      return null;
    }

    const client = await this.clientsService.findByDni(dni);
    if (!client) return null;

    return sanitizeClient(client);
  }
}
