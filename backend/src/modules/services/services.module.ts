import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from '../../entities/service.entity';
import { OperatorService } from '../../entities/operator-service.entity';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { OperatorsModule } from '../../modules/operators/operators.module';

@Module({
  imports: [TypeOrmModule.forFeature([Service, OperatorService]), OperatorsModule],
  providers: [ServicesService, PermissionsGuard],
  controllers: [ServicesController],
  exports: [ServicesService, TypeOrmModule],
})
export class ServicesModule {}
