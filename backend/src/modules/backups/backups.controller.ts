import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { BackupsService } from './backups.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('backups')
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Post()
  @Permissions(Permission.MANAGE_SETTINGS)
  async triggerBackup(@Body() body: { directory?: string | null } = {}) {
    const result = await this.backupsService.createBackup({
      directory: body?.directory ?? undefined,
      mode: 'manual',
    });

    return {
      fileName: result.fileName,
      directory: result.directory,
      generatedAt: result.generatedAt.toISOString(),
      size: result.size,
      downloadPath: `/api/backups/files/${encodeURIComponent(result.fileName)}`,
    };
  }

  @Get('status')
  @Permissions(Permission.MANAGE_SETTINGS)
  async status() {
    return this.backupsService.getStatus();
  }

  @Get('directories')
  @Permissions(Permission.MANAGE_SETTINGS)
  async listDirectories(@Query('path') path?: string) {
    return this.backupsService.listDirectories(path);
  }

  @Post('directories')
  @Permissions(Permission.MANAGE_SETTINGS)
  async createDirectory(@Body() body: { path?: string }) {
    return this.backupsService.createDirectory(body?.path ?? '');
  }

  @Get('files/:fileName')
  @Permissions(Permission.MANAGE_SETTINGS)
  async download(@Param('fileName') fileName: string, @Res() res: Response) {
    const resource = await this.backupsService.getBackupFile(fileName);

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Length', resource.size.toString());
    res.setHeader('Content-Disposition', `attachment; filename="${resource.fileName}"`);
    res.setHeader('Content-Transfer-Encoding', 'binary');
    res.setHeader('Cache-Control', 'no-store');

    resource.stream.on('error', (err) => {
      res.status(500).send({ message: err.message });
    });

    resource.stream.pipe(res);
  }
}
