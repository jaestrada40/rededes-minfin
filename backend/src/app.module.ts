import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';
import { FeedsModule } from './feeds/feeds.module';
import { PortalsModule } from './portals/portals.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    PrismaModule,
    RolesModule,
    UsersModule,
    AuditModule,
    AuthModule,
    SettingsModule,
    FeedsModule,
    PortalsModule,
  ],
})
export class AppModule {}
