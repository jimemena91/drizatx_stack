import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Operator } from '../../entities/operator.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Service as ServiceEntity } from '../../entities/service.entity';
import { OperatorService } from '../../entities/operator-service.entity';
import { Role } from '../../entities/role.entity';
import { OperatorRole } from '../../entities/operator-role.entity';
import { OperatorShift } from '../../entities/operator-shift.entity';
import { OperatorAvailability } from '../../entities/operator-availability.entity';

import { OperatorsService } from './operators.service';
import { OperatorsController } from './operators.controller';

// ⬇️ importá el guard localmente
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Operator,
      Ticket,
      ServiceEntity,
      OperatorService,
      OperatorShift,
      OperatorAvailability,
      Role,
      OperatorRole,
    ]),
  ],
  controllers: [OperatorsController],
  providers: [OperatorsService, PermissionsGuard], // ⬅️ importante
  exports: [OperatorsService, TypeOrmModule],
})
export class OperatorsModule {}
