import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLog } from '../../entities/audit-log.entity';
import { Operator } from '../../entities/operator.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, Operator])],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, PermissionsGuard],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
