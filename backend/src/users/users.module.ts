import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesModule } from '../roles/roles.module';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [RolesModule, AuditModule, CommonModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
