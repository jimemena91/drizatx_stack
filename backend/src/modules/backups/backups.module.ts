import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from '../../entities/service.entity';
import { Operator } from '../../entities/operator.entity';
import { OperatorService } from '../../entities/operator-service.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Client } from '../../entities/client.entity';
import { CustomMessage } from '../../entities/custom-message.entity';
import { SystemSetting } from '../../entities/system-setting.entity';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { ReportSnapshot } from '../../entities/report-snapshot.entity';
import { OperatorRole } from '../../entities/operator-role.entity';
import { BackupsService } from './backups.service';
import { BackupsController } from './backups.controller';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { BackupsSchedulerService } from './backups.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Service,
      Operator,
      OperatorService,
      OperatorRole,
      Ticket,
      Client,
      CustomMessage,
      SystemSetting,
      Role,
      Permission,
      RolePermission,
      ReportSnapshot,
    ]),
    SystemSettingsModule,
  ],
  providers: [BackupsService, BackupsSchedulerService],
  controllers: [BackupsController],
  exports: [BackupsService],
})
export class BackupsModule {}
