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

  @Roles('admin', 'editor', 'auditor', 'viewer')
  @Get()
  get() {
    return this.settings.get();
  }

  @Roles('admin')
  @Patch()
  update(@Body() dto: UpdateSettingsDto, @Req() req: Request & { user: { email: string } }) {
    return this.settings.update(dto, req.user);
  }
}
