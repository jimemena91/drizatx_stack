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
import { SystemSettingsService } from './system-settings.service';
import { SystemSetting } from '../../entities/system-setting.entity';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('system-settings')
export class SystemSettingsController {
  constructor(private readonly systemSettings: SystemSettingsService) {}

  @Get()
  @Permissions(Permission.MANAGE_SETTINGS)
  findAll(): Promise<SystemSetting[]> {
    return this.systemSettings.findAll();
  }

  @Get(':key')
  @Permissions(Permission.MANAGE_SETTINGS)
  get(@Param('key') key: string): Promise<SystemSetting> {
    return this.systemSettings.get(key);
  }

  // Upsert por clave
  @Post(':key')
  @Permissions(Permission.MANAGE_SETTINGS)
  set(
    @Param('key') key: string,
    @Body() body: { value: string; description?: string | null },
  ): Promise<SystemSetting> {
    return this.systemSettings.set(key, body.value, body.description);
  }

  @Post()
  @Permissions(Permission.MANAGE_SETTINGS)
  create(@Body() body: Partial<SystemSetting>): Promise<SystemSetting> {
    return this.systemSettings.create(body);
  }

  @Put(':id')
  @Permissions(Permission.MANAGE_SETTINGS)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<SystemSetting>,
  ): Promise<SystemSetting | null> {
    return this.systemSettings.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions(Permission.MANAGE_SETTINGS)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.systemSettings.remove(id);
  }
}
