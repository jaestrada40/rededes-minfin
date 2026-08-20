import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [AuditModule, CommonModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
