import { Controller, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('public')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('branding')
  getBranding() {
    return this.settings.getPublicBranding();
  }
}
