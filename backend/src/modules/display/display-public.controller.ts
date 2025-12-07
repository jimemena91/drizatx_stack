import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { CustomMessagesService } from '../custom-messages/custom-messages.service';
import { SystemSetting } from '../../entities/system-setting.entity';
import { CustomMessage } from '../../entities/custom-message.entity';

const PUBLIC_SETTING_KEYS = new Set<string>([
  'brandLogoUrl',
  'brandDisplayName',
  'displayTitle',
  'displaySlogan',
  'brandPrimaryColor',
  'brandSecondaryColor',
  'signageTheme',
  'signageCurrencySource',
  'signageIndicatorsRefreshMinutes',
  'signageWeatherLocation',
  'signageWeatherLatitude',
  'signageWeatherLongitude',
  'displayTimeout',
  'showWaitTimes',
  'signageShowNews',
  'signageShowWeather',
  'signageShowWaitingList',
  'signageShowFlowSummary',
  'signageShowKeyIndicators',
]);

function toIso(value?: Date | string | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function sanitizeSetting(setting: SystemSetting) {
  return {
    id: Number(setting.id),
    key: String(setting.key ?? ''),
    value: String(setting.value ?? ''),
    description: setting.description ?? null,
    updatedAt: toIso(setting.updatedAt) ?? new Date().toISOString(),
  };
}

function sanitizeMessage(message: CustomMessage) {
  return {
    id: Number(message.id),
    title: String(message.title ?? ''),
    content: String(message.content ?? ''),
    type: String(message.type ?? 'info'),
    active: Boolean(message.active),
    priority: Number(message.priority ?? 0),
    startDate: toIso(message.startDate),
    endDate: toIso(message.endDate),
    mediaUrl: message.mediaUrl ?? null,
    mediaType: message.mediaType ?? null,
    displayDurationSeconds: message.displayDurationSeconds ?? null,
    activeDays: message.activeDays ?? null,
    createdAt: toIso(message.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(message.updatedAt) ?? new Date().toISOString(),
  };
}

@ApiTags('display/public')
@Controller('display/public')
export class DisplayPublicController {
  constructor(
    private readonly systemSettings: SystemSettingsService,
    private readonly customMessages: CustomMessagesService,
  ) {}

  @Get('system-settings')
  async getPublicSystemSettings() {
    const settings = await this.systemSettings.findAll();
    return settings
      .filter((setting) => PUBLIC_SETTING_KEYS.has(setting.key))
      .map((setting) => sanitizeSetting(setting));
  }

  @Get('custom-messages')
  async getPublicCustomMessages() {
    const messages = await this.customMessages.findActive(new Date());
    return messages.map((message) => sanitizeMessage(message));
  }
}
