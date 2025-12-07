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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

@ApiTags('custom-messages')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('custom-messages')
export class CustomMessagesController {
  constructor(private readonly customMessages: CustomMessagesService) {}

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

