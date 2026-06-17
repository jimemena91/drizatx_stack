import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { CustomMessagesService } from './custom-messages.service';
import { CustomMessage } from '../../entities/custom-message.entity';
import {
  CreateCustomMessageDto,
  UpdateCustomMessageDto,
} from './dto/create-custom-message.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

type UploadedMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@ApiTags('custom-messages')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('custom-messages')
export class CustomMessagesController {
  private readonly logger = new Logger(CustomMessagesController.name);

  constructor(private readonly customMessages: CustomMessagesService) {}


  @Post('media')
  @Permissions(Permission.MANAGE_SETTINGS)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(@UploadedFile() file?: UploadedMediaFile): Promise<{ mediaUrl: string; mediaType: string }> {
    if (!file) {
      this.logger.warn('uploadMedia rejected: missing file');
      throw new BadRequestException('Archivo requerido. Seleccioná una imagen o video.');
    }

    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4']);
    if (!allowedMimeTypes.has(file.mimetype)) {
      this.logger.warn(`uploadMedia rejected: unsupported mimetype=${file.mimetype} name=${file.originalname}`);
      throw new BadRequestException(`Formato no soportado: ${file.mimetype}. Usá JPG, PNG, GIF, WEBP o MP4.`);
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      this.logger.warn(`uploadMedia rejected: too large size=${file.size} name=${file.originalname}`);
      throw new BadRequestException(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. El límite es 5 MB.`);
    }

    const safeExt =
      file.mimetype === 'image/jpeg' ? '.jpg' :
      file.mimetype === 'image/png' ? '.png' :
      file.mimetype === 'image/gif' ? '.gif' :
      file.mimetype === 'image/webp' ? '.webp' :
      file.mimetype === 'video/mp4' ? '.mp4' :
      extname(file.originalname).toLowerCase();

    const fileName = `message-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
    const uploadDir = join(process.cwd(), '..', 'frontend', 'public', 'uploads', 'display-messages');

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(join(uploadDir, fileName), file.buffer);

    return {
      mediaUrl: `/uploads/display-messages/${fileName}`,
      mediaType: file.mimetype,
    };
  }

  @Get()
  @Permissions(Permission.MANAGE_SETTINGS)
  findAll(): Promise<CustomMessage[]> {
    return this.customMessages.findAll();
  }

  @Get('active')
  @Permissions(Permission.MANAGE_SETTINGS)
  findActive(@Query('now') now?: string): Promise<CustomMessage[]> {
    const reference = now ? new Date(now) : new Date();
    return this.customMessages.findActive(reference);
  }

  @Get(':id')
  @Permissions(Permission.MANAGE_SETTINGS)
  findOne(@Param('id', ParseIntPipe) id: number): Promise<CustomMessage> {
    return this.customMessages.findOne(id);
  }

  @Post()
  @Permissions(Permission.MANAGE_SETTINGS)
  create(@Body() body: CreateCustomMessageDto): Promise<CustomMessage> {
    return this.customMessages.create(body);
  }

  @Put(':id')
  @Permissions(Permission.MANAGE_SETTINGS)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCustomMessageDto,
  ): Promise<CustomMessage> {
    return this.customMessages.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions(Permission.MANAGE_SETTINGS)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.customMessages.remove(id);
  }
}

