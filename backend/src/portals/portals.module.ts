import { Module } from '@nestjs/common';
import { PortalsService } from './portals.service';
import { PortalsController } from './portals.controller';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [AuditModule, CommonModule],
  providers: [PortalsService],
  controllers: [PortalsController],
  exports: [PortalsService],
})
export class PortalsModule {}
