import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

import { AclService } from './acl.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Controller('acl')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class AclController {
  constructor(private readonly aclService: AclService) {}

  @Get('roles')
  @Permissions(Permission.MANAGE_ROLES, Permission.MANAGE_SETTINGS)
  listRoles() {
    return this.aclService.listRoles();
  }

  @Get('permissions')
  @Permissions(Permission.MANAGE_ROLES, Permission.MANAGE_SETTINGS)
  listPermissions() {
    return this.aclService.listPermissions();
  }

  @Post('roles')
  @Permissions(Permission.MANAGE_ROLES)
  createRole(@Body() dto: CreateRoleDto) {
    return this.aclService.createRole(dto);
  }

  @Put('roles/:id')
  @Permissions(Permission.MANAGE_ROLES)
  updateRole(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.aclService.updateRole(id, dto);
  }

  @Put('roles/:id/permissions')
  @Permissions(Permission.MANAGE_ROLES)
  updateRolePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.aclService.updateRolePermissions(id, dto);
  }
}
