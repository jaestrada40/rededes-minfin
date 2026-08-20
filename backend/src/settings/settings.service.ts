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

  async update(dto: UpdateSettingsDto, actor: { email: string }): Promise<SystemSettings> {
    const settings = await this.prisma.systemSettings.update({
      where: { id: 'default' },
      data: dto as any,
    });

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Actualizó configuración del sistema',
      module: 'Configuración',
      result: 'Exitoso',
    });

    return settings;
  }
}
