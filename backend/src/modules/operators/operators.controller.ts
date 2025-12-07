import {
  BadRequestException,
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
  Req,
  ForbiddenException,
  Patch,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { OperatorsService } from './operators.service';
import { CreateOperatorDto } from './dto/create-operator.dto';
import { UpdateOperatorServicesDto } from './dto/update-operator-services.dto';
import { UpdateOperatorDto } from './dto/update-operator.dto';
import { AdminUpdatePasswordDto } from './dto/admin-update-password.dto';
import { UpdateOperatorAvailabilityDto } from './dto/update-operator-availability.dto';
import { GetOperatorAttentionMetricsDto } from './dto/get-operator-attention-metrics.dto';
import { GetOperatorShiftsDto } from './dto/get-operator-shifts.dto';

import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { resolveHighestRole } from '../../common/utils/role.utils';
import { Role } from '../../common/enums/role.enum';
import { Permission } from '../../common/enums/permission.enum';

@UseGuards(AuthGuard('jwt')) // 👈 solo JWT a nivel clase
@Controller('operators')
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /** Permite acceso si el sujeto es el mismo operador o el usuario tiene rol elevado. */
  private assertSelfOrElevated(req: Request, operatorId: number, message?: string) {
    const user = (req as any)?.user ?? {};
    const resolved = resolveHighestRole([
      ...(Array.isArray(user?.roles) ? user.roles : []),
      user?.role,
    ]);

    if (resolved === Role.OPERATOR) {
      const subject = Number(user?.sub ?? user?.userId);
      if (!Number.isFinite(subject) || subject !== operatorId) {
        throw new ForbiddenException(message ?? 'No puede acceder a datos de otro operador');
      }
    }
  }

  /** Normaliza y verifica si el usuario tiene alguno de los permisos indicados. */
  private hasAnyPermission(req: Request, ...perms: Array<Permission | string>): boolean {
    const raw: any[] = (req as any)?.user?.permissions ?? [];
    const userPerms = raw.map((p) => String(p).trim().toLowerCase());

    // Aceptar alias "call_tickets" ↔ "serve_tickets"
    const wanted = perms
      .map((p) => String(p).trim().toLowerCase())
      .flatMap((p) =>
        p === 'serve_tickets'
          ? ['serve_tickets', 'call_tickets']
          : p === 'call_tickets'
          ? ['call_tickets', 'serve_tickets']
          : [p],
      );

    return wanted.some((w) => userPerms.includes(w));
  }

  /** Devuelve info mínima del actor para auditoría. */
  private buildActor(req: Request) {
    const user = (req as any)?.user ?? {};
    const candidateId = user?.sub ?? user?.userId;
    const parsedId =
      typeof candidateId === 'number'
        ? candidateId
        : candidateId !== undefined && candidateId !== null
        ? Number(candidateId)
        : undefined;
    const id = Number.isFinite(parsedId) ? Number(parsedId) : undefined;

    const roles: Array<string | Role | null | undefined> = [
      ...(Array.isArray(user?.roles) ? user.roles : []),
      user?.role,
    ];

    return { id, roles };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Listados y consultas "admin/supervisor" (mantienen PermissionsGuard)
  // ─────────────────────────────────────────────────────────────────────────────

  @UseGuards(PermissionsGuard)
  @Get()
  @Permissions(Permission.MANAGE_OPERATORS)
  findAll() {
    return this.operatorsService.findAllWithStatus();
  }

  @UseGuards(PermissionsGuard)
  @Get('with-status')
  @Permissions(Permission.MANAGE_OPERATORS)
  findAllWithStatus() {
    return this.operatorsService.findAllWithStatus();
  }

  @UseGuards(PermissionsGuard)
  @Get('active')
  @Permissions(Permission.SERVE_TICKETS)
  findActive() {
    return this.operatorsService.findActive();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Consultas "self" (NO pasan por PermissionsGuard → evitan 403 si es el propio operador)
  // ─────────────────────────────────────────────────────────────────────────────

  @Get(':id(\\d+)/with-status')
  async findOneWithStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    this.assertSelfOrElevated(req, id);
    return this.operatorsService.findOneWithStatus(id);
  }

  @Get(':id(\\d+)/services')
  getServices(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    this.assertSelfOrElevated(req, id);
    return this.operatorsService.getServicesForOperator(id);
  }

  @Get(':id(\\d+)')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    this.assertSelfOrElevated(req, id);
    return this.operatorsService.findOne(id);
  }

  @Patch(':id(\\d+)/status')
  updateAvailabilityStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperatorAvailabilityDto,
    @Req() req: Request,
  ) {
    this.assertSelfOrElevated(req, id);
    // Para cambiar estado, requerimos permiso operativo (serve/call) pero lo validamos manual
    if (!this.hasAnyPermission(req, Permission.SERVE_TICKETS, 'call_tickets')) {
      throw new ForbiddenException('No tenés permisos para actualizar disponibilidad.');
    }
    if (!dto?.status) {
      throw new BadRequestException('status requerido');
    }
    return this.operatorsService.updateAvailabilityStatus(id, dto.status, this.buildActor(req));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Métricas/turnos (self u elevado). Si querés forzar VIEW_REPORTS para todos, poné el Guard.
  // ─────────────────────────────────────────────────────────────────────────────

  @Get(':id(\\d+)/attention-metrics')
  getAttentionMetrics(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetOperatorAttentionMetricsDto,
    @Req() req: Request,
  ) {
    this.assertSelfOrElevated(req, id);
    return this.operatorsService.getAttentionMetrics(id, query);
  }

  @Get(':id(\\d+)/shifts')
  getShiftHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetOperatorShiftsDto,
    @Req() req: Request,
  ) {
    this.assertSelfOrElevated(req, id);
    return this.operatorsService.getShiftHistory(id, query);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Llamado de tickets (validación manual de permisos + self + asignación)
  // ─────────────────────────────────────────────────────────────────────────────

  @Post(':id(\\d+)/call-next/:serviceId(\\d+)')
  @HttpCode(200)
  callNextByService(
    @Param('id', ParseIntPipe) operatorId: number,
    @Param('serviceId', ParseIntPipe) serviceId: number,
    @Req() req: Request,
  ) {
    this.assertSelfOrElevated(req, operatorId, 'No puede operar en nombre de otro operador');
    if (!this.hasAnyPermission(req, Permission.SERVE_TICKETS, 'call_tickets')) {
      throw new ForbiddenException('No tenés permiso para llamar turnos.');
    }
    // (Opcional pero recomendado) Validar asignación del servicio al operador
    // await this.operatorsService.assertServiceAssigned(operatorId, serviceId);
    return this.operatorsService.callNextByService(operatorId, serviceId);
  }

  /** Llamar siguiente ticket priorizando entre todos los servicios habilitados */
  @Post(':id(\\d+)/call-next')
  @HttpCode(200)
  callNext(
    @Param('id', ParseIntPipe) operatorId: number,
    @Req() req: Request,
  ) {
    this.assertSelfOrElevated(req, operatorId, 'No puede operar en nombre de otro operador');
    if (!this.hasAnyPermission(req, Permission.SERVE_TICKETS, 'call_tickets')) {
      throw new ForbiddenException('No tenés permiso para llamar turnos.');
    }
    return this.operatorsService.callNext(operatorId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Gestión/CRUD (solo admin/supervisor) — se mantiene PermissionsGuard
  // ─────────────────────────────────────────────────────────────────────────────

  @UseGuards(PermissionsGuard)
  @Put(':id(\\d+)/services')
  @Permissions(Permission.MANAGE_SERVICES)
  replaceServices(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperatorServicesDto,
  ) {
    return this.operatorsService.replaceServices(id, dto.serviceIds);
  }

  @UseGuards(PermissionsGuard)
  @Post()
  @Permissions(Permission.MANAGE_OPERATORS)
  create(@Body() body: CreateOperatorDto) {
    return this.operatorsService.create(body);
  }

  @UseGuards(PermissionsGuard)
  @Put(':id(\\d+)')
  @Permissions(Permission.MANAGE_OPERATORS)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateOperatorDto,
    @Req() req: Request,
  ) {
    return this.operatorsService.update(id, body, this.buildActor(req));
  }

  @UseGuards(PermissionsGuard)
  @Delete(':id(\\d+)')
  @HttpCode(204)
  @Permissions(Permission.MANAGE_OPERATORS)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    await this.operatorsService.remove(id, this.buildActor(req));
  }

  // 🔐 Cambiar contraseña (solo ADMIN)
  @UseGuards(PermissionsGuard)
  @Patch(':id(\\d+)/password')
  @Permissions(Permission.MANAGE_OPERATORS)
  async adminChangePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdatePasswordDto,
    @Req() req: any,
  ) {
    if (dto.password === undefined || dto.password === null) {
      throw new BadRequestException('password requerido');
    }
    return this.operatorsService.adminUpdatePassword(
      id,
      String(dto.password),
      this.buildActor(req),
    );
  }
}
