import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Roles('super_admin', 'admin', 'editor')
  @Get()
  async get(@Req() req: Request & { user: { id: string; email: string; role: string } }) {
    const settings = await this.settings.get();
    if (req.user.role !== 'super_admin') {
      return { ...settings, webhookSecret: undefined, apiKeys: undefined };
    }
    return settings;
  }

  @Roles('super_admin')
  @Patch()
  update(@Body() dto: UpdateSettingsDto, @Req() req: Request & { user: { id: string; email: string; role: string } }) {
    return this.settings.update(dto, req.user);
  }
}
