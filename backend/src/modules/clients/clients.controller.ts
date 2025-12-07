import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Client } from '../../entities/client.entity';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Permissions(Permission.SERVE_TICKETS)
  findAll(@Query('q') q?: string): Promise<Client[]> {
    if (q && q.trim()) return this.clientsService.search(q.trim());
    return this.clientsService.findAll();
  }

  @Get('dni/:dni')
  @Permissions(Permission.SERVE_TICKETS)
  findByDni(@Param('dni') dni: string): Promise<Client | null> {
    return this.clientsService.findByDni(dni);
  }

  @Get(':id/history')
  @Permissions(Permission.SERVE_TICKETS)
  getHistory(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.getHistory(id);
  }

  @Get(':id')
  @Permissions(Permission.SERVE_TICKETS)
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Client> {
    return this.clientsService.findOne(id);
  }

  @Post()
  @Permissions(Permission.SERVE_TICKETS)
  create(@Body() body: Partial<Client>): Promise<Client> {
    // TIP: en producción usar DTO + class-validator
    return this.clientsService.create(body);
  }

  @Put(':id')
  @Permissions(Permission.SERVE_TICKETS)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<Client>,
  ): Promise<Client> {
    return this.clientsService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204) // RESTful 204 No Content
  @Permissions(Permission.SERVE_TICKETS)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.clientsService.remove(id);
  }
}
