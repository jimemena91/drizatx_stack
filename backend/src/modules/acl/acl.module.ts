import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Role } from '../../entities/role.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { Permission as PermissionEntity } from '../../entities/permission.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

import { AclController } from './acl.controller';
import { AclService } from './acl.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, RolePermission, PermissionEntity])],
  controllers: [AclController],
  providers: [AclService, PermissionsGuard],
  exports: [AclService],
})
export class AclModule {}
