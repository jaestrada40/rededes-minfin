import { Module } from '@nestjs/common';
import { FeedsService } from './feeds.service';
import { FeedsController } from './feeds.controller';
import { PublicFeedsController } from './public-feeds.controller';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AuditModule, CommonModule, SettingsModule],
  providers: [FeedsService],
  controllers: [FeedsController, PublicFeedsController],
  exports: [FeedsService],
})
export class FeedsModule {}
