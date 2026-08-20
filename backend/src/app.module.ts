import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [PrismaModule, RolesModule, UsersModule, AuditModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
