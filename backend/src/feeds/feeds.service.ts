import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { Feed } from '@prisma/client';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class FeedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateFeedDto, actor: { email: string }): Promise<Feed> {
    const slug = dto.slug || slugify(dto.name) || `feed-${Date.now()}`;
    const feed = await this.prisma.feed.create({
      data: {
        slug,
        name: dto.name,
        description: dto.description,
        network: dto.network,
        status: dto.status ?? 'active',
        layoutDefault: dto.layoutDefault ?? 'grid',
        maxItemsDefault: dto.maxItemsDefault ?? 6,
        showMetrics: dto.showMetrics ?? true,
        showMedia: dto.showMedia ?? true,
        autoRefreshMinutes: dto.autoRefreshMinutes ?? 5,
        updatedBy: actor.email,
      },
    });

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Creó nuevo feed institucional',
      module: 'Feeds',
      entity: 'Feed',
      entityId: feed.id,
      details: { slug: feed.slug, name: feed.name },
      result: 'Exitoso',
    });

    return feed;
  }

  findAll(): Promise<Feed[]> {
    return this.prisma.feed.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findOne(id: string) {
    return this.prisma.feed.findUniqueOrThrow({
      where: { id },
      include: {
        posts: { orderBy: { order: 'asc' }, include: { post: true } },
        portals: { include: { portal: true } },
      },
    });
  }

  async update(id: string, dto: UpdateFeedDto, actor: { email: string }): Promise<Feed> {
    const feed = await this.prisma.feed.update({
      where: { id },
      data: { ...dto, updatedBy: actor.email },
    });

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Actualizó configuración de feed',
      module: 'Feeds',
      entity: 'Feed',
      entityId: feed.id,
      result: 'Exitoso',
    });

    return feed;
  }

  async remove(id: string, actor: { email: string }): Promise<void> {
    const feed = await this.prisma.feed.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Feed no encontrado');
    });

    await this.prisma.feed.delete({ where: { id } });

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Eliminó feed institucional',
      module: 'Feeds',
      entity: 'Feed',
      entityId: id,
      details: { slug: feed.slug, name: feed.name },
      result: 'Advertencia',
    });
  }

  async duplicate(id: string, actor: { email: string }): Promise<Feed> {
    const target = await this.prisma.feed.findUniqueOrThrow({ where: { id } });
    const copySlug = `${target.slug}-copia-${Math.floor(Math.random() * 1000)}`;

    const copy = await this.prisma.feed.create({
      data: {
        slug: copySlug,
        name: `${target.name} (Copia)`,
        description: target.description,
        network: target.network,
        status: target.status,
        layoutDefault: target.layoutDefault,
        maxItemsDefault: target.maxItemsDefault,
        showMetrics: target.showMetrics,
        showMedia: target.showMedia,
        autoRefreshMinutes: target.autoRefreshMinutes,
        updatedBy: actor.email,
      },
    });

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Duplicó feed existente',
      module: 'Feeds',
      entity: 'Feed',
      entityId: copy.id,
      details: { copySlug },
      result: 'Exitoso',
    });

    return copy;
  }
}
