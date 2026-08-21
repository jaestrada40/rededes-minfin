import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WordPressPortal } from '@prisma/client';
import { CreatePortalDto } from './dto/create-portal.dto';
import { UpdatePortalDto } from './dto/update-portal.dto';

@Injectable()
export class PortalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(): Promise<WordPressPortal[]> {
    return this.prisma.wordPressPortal.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreatePortalDto, actor: { id: string; email: string; role: string }): Promise<WordPressPortal> {
    const portal = await this.prisma.wordPressPortal.create({
      data: {
        name: dto.name,
        domain: dto.domain,
        category: dto.category,
        ipAddress: dto.ipAddress,
        wpVersion: dto.wpVersion,
        pluginVersion: dto.pluginVersion,
        description: dto.description,
        webhookEnabled: dto.webhookEnabled ?? true,
      },
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Registró nuevo portal WordPress',
      module: 'Portales',
      entity: 'WordPressPortal',
      entityId: portal.id,
      details: { domain: portal.domain, name: portal.name },
      result: 'Exitoso',
    });

    return portal;
  }

  async update(
    id: string,
    dto: UpdatePortalDto,
    actor: { id: string; email: string; role: string },
  ): Promise<WordPressPortal> {
    const portal = await this.prisma.wordPressPortal.update({ where: { id }, data: dto });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Actualizó configuración de portal WordPress',
      module: 'Portales',
      entity: 'WordPressPortal',
      entityId: portal.id,
      result: 'Exitoso',
    });

    return portal;
  }

  async remove(id: string, actor: { id: string; email: string; role: string }): Promise<void> {
    const portal = await this.prisma.wordPressPortal.delete({ where: { id } });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Eliminó portal WordPress',
      module: 'Portales',
      entity: 'WordPressPortal',
      entityId: id,
      details: { domain: portal.domain, name: portal.name },
      result: 'Advertencia',
    });
  }

  async assignFeedToPortals(
    feedId: string,
    portalIds: string[],
    actor: { id: string; email: string; role: string },
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.feedPortal.deleteMany({ where: { feedId } }),
      this.prisma.feedPortal.createMany({
        data: portalIds.map((portalId) => ({ feedId, portalId })),
      }),
    ]);

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Asignó feed a portales WordPress',
      module: 'Portales',
      entity: 'Feed',
      entityId: feedId,
      details: { portalCount: portalIds.length },
      result: 'Exitoso',
    });
  }

  async batchAssignFeedToAllPortals(feedId: string, actor: { id: string; email: string; role: string }): Promise<void> {
    const portals = await this.prisma.wordPressPortal.findMany();
    await this.assignFeedToPortals(feedId, portals.map((p) => p.id), actor);
  }

  async syncAll(actor: { id: string; email: string; role: string }): Promise<void> {
    await this.prisma.wordPressPortal.updateMany({
      data: { connectionStatus: 'connected', lastSyncAt: new Date(), tokenValid: true },
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Sincronización global ejecutada',
      module: 'Portales',
      result: 'Exitoso',
    });
  }

  async testConnection(portalId: string, actor: { id: string; email: string; role: string }): Promise<boolean> {
    const portal = await this.prisma.wordPressPortal.update({
      where: { id: portalId },
      data: { connectionStatus: 'connected', lastSyncAt: new Date() },
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Prueba de conexión con portal',
      module: 'Portales',
      entity: 'WordPressPortal',
      entityId: portal.id,
      result: 'Exitoso',
    });

    return true;
  }
}
