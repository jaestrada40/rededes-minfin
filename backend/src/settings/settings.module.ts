import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { PublicSettingsController } from './public-settings.controller';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [AuditModule, CommonModule],
  providers: [SettingsService],
  controllers: [SettingsController, PublicSettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
