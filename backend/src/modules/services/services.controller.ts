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
  UseGuards,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { Service } from '../../entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { OperatorsService } from '../../modules/operators/operators.service';
import { UpdateServiceOperatorsDto } from './dto/update-service-operators.dto';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('services')
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly operatorsService: OperatorsService,
  ) {}

  @Get()
  @Permissions(Permission.MANAGE_SERVICES, Permission.SERVE_TICKETS)
  findAll(): Promise<Service[]> {
    return this.servicesService.findAll();
  }

  @Get('active')
  @Permissions(Permission.MANAGE_SERVICES, Permission.SERVE_TICKETS)
  findActive(): Promise<Service[]> {
    return this.servicesService.findActive();
  }

  @Get(':id')
  @Permissions(Permission.MANAGE_SERVICES, Permission.SERVE_TICKETS)
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Service> {
    return this.servicesService.findOne(id);
  }

  @Get(':id/operators')
  @Permissions(Permission.MANAGE_SERVICES, Permission.SERVE_TICKETS)
  findOperators(@Param('id', ParseIntPipe) id: number) {
    return this.operatorsService.findOperatorsByService(id);
  }

  @Post()
  @Permissions(Permission.MANAGE_SERVICES)
  create(@Body() body: CreateServiceDto): Promise<Service> {
    return this.servicesService.create(body);
  }

  @Put(':id')
  @Permissions(Permission.MANAGE_SERVICES)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateServiceDto,
  ): Promise<Service> {
    return this.servicesService.update(id, body);
  }

  @Put(':id/operators')
  @Permissions(Permission.MANAGE_SERVICES)
  replaceOperators(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceOperatorsDto,
  ) {
    return this.operatorsService.replaceOperatorsForService(id, dto.operatorIds ?? []);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions(Permission.MANAGE_SERVICES)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.servicesService.remove(id);
  }
}
