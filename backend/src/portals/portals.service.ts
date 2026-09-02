import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WordPressPortal } from '@prisma/client';
import { resolve4, resolve6 } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
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

  async create(
    dto: CreatePortalDto,
    actor: { id: string; email: string; role: string },
  ): Promise<WordPressPortal> {
    const portal = await this.prisma.wordPressPortal.create({
      data: {
        name: dto.name,
        domain: dto.domain,
        category: dto.category,
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
    const portal = await this.prisma.wordPressPortal.update({
      where: { id },
      data: dto,
    });

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

  async remove(
    id: string,
    actor: { id: string; email: string; role: string },
  ): Promise<void> {
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

  async batchAssignFeedToAllPortals(
    feedId: string,
    actor: { id: string; email: string; role: string },
  ): Promise<void> {
    const portals = await this.prisma.wordPressPortal.findMany();
    await this.assignFeedToPortals(
      feedId,
      portals.map((p) => p.id),
      actor,
    );
  }

  // El gestor no tiene credenciales para autenticarse contra el WP REST API
  // de cada portal (la integración es al revés: el plugin de WordPress
  // consulta a nuestro /public/feeds, no nosotros a WordPress). Lo único que
  // podemos verificar honestamente es que el dominio responde. Cualquier
  // respuesta HTTP cuenta como "vivo" — incluso un 403, ya que muchos
  // portales institucionales tienen un WAF que bloquea pings automatizados
  // sin que eso signifique que el sitio esté caído. Solo un fallo de red real
  // (DNS, timeout, conexión rechazada) se considera "sin conexión".
  private async checkPortalReachable(domain: string): Promise<boolean> {
    // El valor procede de la administración, pero no debe convertirse en un
    // proxy hacia la red interna. Solo aceptamos FQDN públicos y comprobamos
    // todas sus resoluciones antes de abrir la conexión.
    if (
      !/^(?=.{1,253}$)(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(domain) ||
      isIP(domain)
    ) {
      return false;
    }
    try {
      const resolutions = await Promise.allSettled([
        resolve4(domain),
        resolve6(domain),
      ]);
      const addresses = resolutions.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      );
      if (
        !addresses.length ||
        addresses.some((address) => this.isPrivateAddress(address))
      ) {
        return false;
      }
      return await this.fetchPinnedHttps(domain, addresses[0]);
    } catch {
      return false;
    }
  }

  private fetchPinnedHttps(
    hostname: string,
    address: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const req = request(
        {
          hostname,
          method: 'GET',
          timeout: 6000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MinfinGestorBot/1.0)',
          },
          lookup: (_host, _options, callback) =>
            callback(null, address, isIP(address) === 6 ? 6 : 4),
        },
        (res) => {
          res.resume();
          resolve(true);
        },
      );
      req.once('timeout', () => req.destroy());
      req.once('error', () => resolve(false));
      req.end();
    });
  }

  private isPrivateAddress(address: string): boolean {
    const normalized = address.toLowerCase();
    const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mappedIpv4) return this.isPrivateAddress(mappedIpv4);
    if (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd')
    )
      return true;
    const [a, b] = normalized.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }

  async syncAll(actor: {
    id: string;
    email: string;
    role: string;
  }): Promise<void> {
    const portals = await this.prisma.wordPressPortal.findMany();

    await Promise.all(
      portals.map(async (portal) => {
        const reachable = await this.checkPortalReachable(portal.domain);
        await this.prisma.wordPressPortal.update({
          where: { id: portal.id },
          data: {
            connectionStatus: reachable ? 'connected' : 'error',
            tokenValid: reachable,
            ...(reachable ? { lastSyncAt: new Date() } : {}),
          },
        });
      }),
    );

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Sincronización global ejecutada',
      module: 'Portales',
      result: 'Exitoso',
    });
  }

  async testConnection(
    portalId: string,
    actor: { id: string; email: string; role: string },
  ): Promise<boolean> {
    const target = await this.prisma.wordPressPortal.findUniqueOrThrow({
      where: { id: portalId },
    });
    const reachable = await this.checkPortalReachable(target.domain);

    const portal = await this.prisma.wordPressPortal.update({
      where: { id: portalId },
      data: {
        connectionStatus: reachable ? 'connected' : 'error',
        tokenValid: reachable,
        ...(reachable ? { lastSyncAt: new Date() } : {}),
      },
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Prueba de conexión con portal',
      module: 'Portales',
      entity: 'WordPressPortal',
      entityId: portal.id,
      details: { domain: portal.domain, reachable },
      result: reachable ? 'Exitoso' : 'Fallido',
    });

    return reachable;
  }
}
