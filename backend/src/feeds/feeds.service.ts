import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { SettingsService } from '../settings/settings.service';
import { Feed } from '@prisma/client';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function extractPostIdAndDetails(input: string, network: string): { postId: string; url: string } {
  const trimmed = input.trim();
  let postId = trimmed;
  let url = trimmed;

  if (network === 'x') {
    const match = trimmed.match(/(?:twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i);
    if (match) {
      postId = match[2];
      url = `https://x.com/${match[1]}/status/${postId}`;
    } else if (/^\d+$/.test(trimmed)) {
      postId = trimmed;
      url = `https://x.com/MinfinGT/status/${trimmed}`;
    }
  } else if (network === 'instagram') {
    const match = trimmed.match(/(?:instagram\.com)\/(?:p|reel)\/([A-Za-z0-9_-]+)/i);
    if (match) {
      postId = match[1];
      url = `https://www.instagram.com/p/${postId}/`;
    }
  } else if (network === 'youtube') {
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
    if (match) {
      postId = match[1];
      url = `https://www.youtube.com/watch?v=${postId}`;
    }
  } else if (network === 'facebook') {
    const match =
      trimmed.match(/facebook\.com\/(?:.+)\/(?:posts|videos|reel)\/([A-Za-z0-9_-]+)/i) ||
      trimmed.match(/pfbid([A-Za-z0-9]+)/);
    if (match) postId = match[1] || match[0];
  } else if (network === 'linkedin') {
    const match =
      trimmed.match(/activity:(\d+)/) ||
      trimmed.match(/urn:li:activity:(\d+)/) ||
      trimmed.match(/\/posts\/([A-Za-z0-9_-]+)/);
    if (match) postId = match[1];
  }

  return { postId, url };
}

const SAMPLE_CONTENT: Record<string, string> = {
  x: '🇬🇹 #MINFINInforma | Publicación oficial de @MinfinGT sobre finanzas públicas, ejecución presupuestaria y modernización del Estado.',
  facebook: 'Reunión de coordinación técnica en el Ministerio de Finanzas Públicas con autoridades para el fortalecimiento institucional.',
  instagram: 'Boletín visual oficial del Ministerio de Finanzas Públicas de Guatemala. Conoce más en minfin.gob.gt #Transparencia',
  youtube: 'Transmisión oficial del MINFIN: Capacitaciones en sistemas de gestión financiera pública.',
  linkedin: 'El Ministerio de Finanzas Públicas comparte oportunidades de desarrollo profesional y novedades del sector hacendario.',
  tiktok: 'Cápsula educativa MINFIN sobre cómo se distribuye el presupuesto de la nación.',
};

@Injectable()
export class FeedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
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

  async addPost(
    feedId: string,
    input: { urlOrId: string; network: string; customContent?: string },
    actor: { email: string },
  ) {
    const feed = await this.prisma.feed.findUniqueOrThrow({ where: { id: feedId } });
    const { postId, url } = extractPostIdAndDetails(input.urlOrId, input.network);

    if (!postId) {
      return { success: false, message: 'No se pudo identificar un ID o URL válida.' };
    }

    let post = await this.prisma.socialPost.findUnique({
      where: { network_postId: { network: input.network, postId } },
    });

    if (!post) {
      const settings = await this.settings.get();
      const account = (settings.officialAccounts as Record<string, { handle?: string; name?: string }>)?.[input.network];

      post = await this.prisma.socialPost.create({
        data: {
          network: input.network,
          postId,
          url,
          authorHandle: account?.handle ?? '@MinfinGT',
          authorName: account?.name ?? 'Ministerio de Finanzas Públicas',
          publishedAt: 'Hoy · Reciente',
          content: input.customContent || SAMPLE_CONTENT[input.network] || '',
          mediaType: input.network === 'youtube' ? 'video' : 'image',
          isValidated: true,
          addedBy: actor.email,
        },
      });
    }

    const existingLink = await this.prisma.feedPost.findUnique({
      where: { feedId_postId: { feedId, postId: post.id } },
    });
    if (existingLink) {
      return { success: false, message: 'La publicación ya se encuentra registrada en este feed.' };
    }

    const linkCount = await this.prisma.feedPost.count({ where: { feedId } });
    await this.prisma.feedPost.create({ data: { feedId, postId: post.id, order: linkCount } });

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Agregó publicación a feed',
      module: 'Publicaciones',
      entity: 'Feed',
      entityId: feed.id,
      details: { postId, network: input.network },
      result: 'Exitoso',
    });

    return { success: true, message: 'Publicación agregada con éxito.', post };
  }

  async removePost(feedId: string, postId: string, actor: { email: string }): Promise<void> {
    await this.prisma.feedPost.delete({ where: { feedId_postId: { feedId, postId } } });

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Eliminó publicación del feed',
      module: 'Publicaciones',
      entity: 'Feed',
      entityId: feedId,
      details: { postId },
      result: 'Exitoso',
    });
  }

  async reorderPosts(feedId: string, orderedPostIds: string[], actor: { email: string }): Promise<void> {
    await Promise.all(
      orderedPostIds.map((postId, index) =>
        this.prisma.feedPost.update({
          where: { feedId_postId: { feedId, postId } },
          data: { order: index },
        }),
      ),
    );

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Reordenó publicaciones',
      module: 'Feeds',
      entity: 'Feed',
      entityId: feedId,
      result: 'Exitoso',
    });
  }

  async updatePostContent(postId: string, content: string, actor: { email: string }) {
    const post = await this.prisma.socialPost.update({ where: { id: postId }, data: { content } });

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Editó contenido de publicación',
      module: 'Publicaciones',
      entity: 'SocialPost',
      entityId: postId,
      result: 'Exitoso',
    });

    return post;
  }
}
