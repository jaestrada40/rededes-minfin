import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SystemSettings } from '@prisma/client';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  get(): Promise<SystemSettings> {
    return this.prisma.systemSettings.findUniqueOrThrow({ where: { id: 'default' } });
  }

  async getPublicBranding(): Promise<{ logoUrl: string | null; institutionName: string }> {
    const settings = await this.prisma.systemSettings.findUniqueOrThrow({
      where: { id: 'default' },
      select: { logoUrl: true, institutionName: true },
    });
    return settings;
  }

  async update(dto: UpdateSettingsDto, actor: { id: string; email: string; role: string }): Promise<SystemSettings> {
    const settings = await this.prisma.systemSettings.update({
      where: { id: 'default' },
      data: dto as any,
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Actualizó configuración del sistema',
      module: 'Configuración',
      result: 'Exitoso',
    });

    return settings;
  }
}
