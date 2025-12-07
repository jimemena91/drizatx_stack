import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from '../../entities/system-setting.entity';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting])], // 👈 clave
  providers: [SystemSettingsService, PermissionsGuard],
  controllers: [SystemSettingsController],
  exports: [SystemSettingsService, TypeOrmModule],       // 👈 lo usan otros módulos
})
export class SystemSettingsModule {}
