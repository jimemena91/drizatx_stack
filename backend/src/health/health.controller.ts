import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    // 200 OK con objeto vacío, simple y suficiente para monitoreo
    return {};
  }
}
