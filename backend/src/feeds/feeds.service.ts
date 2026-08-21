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
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
    if (match) {
      postId = match[1];
      url = `https://www.youtube.com/watch?v=${postId}`;
    } else if (/^[\w-]{11}$/.test(trimmed)) {
      postId = trimmed;
      url = `https://www.youtube.com/watch?v=${trimmed}`;
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

const OEMBED_ENDPOINTS: Record<string, (url: string) => string> = {
  youtube: (url) => `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  tiktok: (url) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
};

interface OEmbedResult {
  title?: string;
  authorName?: string;
  thumbnailUrl?: string;
  authorAvatarUrl?: string;
  publishedAt?: string;
}

const PUBLISHED_AT_FORMATTER = new Intl.DateTimeFormat('es-GT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Guatemala',
});

function formatPublishedAt(date: Date): string {
  return PUBLISHED_AT_FORMATTER.format(date).replace(' a. m.', ' a.m.').replace(' p. m.', ' p.m.');
}

// YouTube y TikTok exponen oEmbed público sin credenciales. Instagram y
// LinkedIn requieren una API key/app aprobada por la plataforma. Facebook se
// resuelve vía Graph API (ver fetchFacebookPost) cuando hay un token
// configurado en Configuración. X se resuelve aparte vía fetchTwitterCard
// (meta tags Open Graph, incluye imagen real). Sin credenciales/servicio
// disponible, se usa contenido de muestra (ver SAMPLE_CONTENT).
async function fetchOEmbed(network: string, url: string): Promise<OEmbedResult | null> {
  const buildUrl = OEMBED_ENDPOINTS[network];
  if (!buildUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(buildUrl(url), { signal: controller.signal });
    if (!res.ok) return null;

    const data = await res.json();
    const authorAvatarUrl =
      network === 'youtube' && typeof data.author_url === 'string'
        ? await fetchYouTubeChannelAvatar(data.author_url)
        : undefined;

    return {
      title: typeof data.title === 'string' ? data.title : undefined,
      authorName: typeof data.author_name === 'string' ? data.author_name : undefined,
      thumbnailUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : undefined,
      authorAvatarUrl,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// El oEmbed de YouTube no incluye el logo del canal, solo la miniatura del
// video. El logo real (mismo que se ve en youtube.com) viene en la etiqueta
// og:image de la página pública del canal — sin necesidad de la YouTube Data
// API ni una API key.
async function fetchYouTubeChannelAvatar(channelUrl: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(channelUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    const match = html.match(/<meta property="og:image" content="([^"]*)"/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

// X ya no sirve etiquetas Open Graph a crawlers sin sesión (devuelve 404 a
// Twitterbot/Facebookexternalhit desde 2023), así que el scraping de tarjeta
// dejó de funcionar. En su lugar se usa el endpoint de sindicación que
// alimenta los widgets de embed oficiales de X (cdn.syndication.twimg.com) —
// público, sin credenciales, y a diferencia del oEmbed oficial (que solo da
// HTML de embed) expone el texto plano y la URL directa de la imagen/video.
async function fetchTwitterCard(postId: string): Promise<OEmbedResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(postId)}&token=a`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (typeof data.text !== 'string') return null;

    const media = Array.isArray(data.mediaDetails) ? data.mediaDetails[0] : undefined;
    const thumbnailUrl =
      typeof media?.media_url_https === 'string'
        ? media.media_url_https
        : typeof data.video?.poster === 'string'
          ? data.video.poster
          : undefined;

    return {
      title: data.text,
      authorName: typeof data.user?.name === 'string' ? data.user.name : undefined,
      thumbnailUrl,
      authorAvatarUrl:
        typeof data.user?.profile_image_url_https === 'string' ? data.user.profile_image_url_https : undefined,
      publishedAt: typeof data.created_at === 'string' ? formatPublishedAt(new Date(data.created_at)) : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Facebook requiere un Page Access Token (Graph API) configurado en
// Configuración > Credenciales de API. postId debe ser el ID nativo del
// post de Facebook (no la URL). Sin token configurado, retorna null y se
// usa contenido de muestra.
async function fetchFacebookPost(postId: string, pageAccessToken?: string): Promise<OEmbedResult | null> {
  if (!pageAccessToken) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(postId)}?fields=message,full_picture,from&access_token=${encodeURIComponent(pageAccessToken)}`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;

    const data = await res.json();
    return {
      title: typeof data.message === 'string' ? data.message : undefined,
      authorName: typeof data.from?.name === 'string' ? data.from.name : undefined,
      thumbnailUrl: typeof data.full_picture === 'string' ? data.full_picture : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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

  async create(dto: CreateFeedDto, actor: { id: string; email: string; role: string }): Promise<Feed> {
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
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Creó nuevo feed institucional',
      module: 'Feeds',
      entity: 'Feed',
      entityId: feed.id,
      details: { slug: feed.slug, name: feed.name },
      result: 'Exitoso',
    });

    return feed;
  }

  findAll() {
    return this.prisma.feed.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        posts: { orderBy: { order: 'asc' }, include: { post: true } },
        portals: { include: { portal: true } },
      },
    });
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

  // Sin autenticación — consumido por el plugin de WordPress (server-to-server,
  // vía wp_remote_get) para renderizar el shortcode público. Solo expone lo
  // necesario para pintar la tarjeta; nada de auditoría ni datos internos.
  async findPublicBySlug(slug: string) {
    const feed = await this.prisma.feed.findUniqueOrThrow({
      where: { slug },
      select: {
        slug: true,
        name: true,
        description: true,
        network: true,
        status: true,
        layoutDefault: true,
        maxItemsDefault: true,
        showMetrics: true,
        showMedia: true,
        posts: {
          orderBy: { order: 'asc' },
          select: {
            post: {
              select: {
                network: true,
                postId: true,
                url: true,
                authorHandle: true,
                authorName: true,
                authorAvatarUrl: true,
                publishedAt: true,
                content: true,
                mediaType: true,
                mediaUrl: true,
                mediaThumb: true,
                videoDuration: true,
                stats: true,
              },
            },
          },
        },
      },
    });

    const settings = await this.settings.get();
    const officialAccounts = (settings.officialAccounts as Record<string, { avatarUrl?: string }>) || {};

    return {
      ...feed,
      posts: feed.posts.map((link) => ({
        ...link,
        post: {
          ...link.post,
          authorAvatarUrl: link.post.authorAvatarUrl || officialAccounts[link.post.network]?.avatarUrl || null,
        },
      })),
    };
  }

  async update(id: string, dto: UpdateFeedDto, actor: { id: string; email: string; role: string }): Promise<Feed> {
    const feed = await this.prisma.feed.update({
      where: { id },
      data: { ...dto, updatedBy: actor.email },
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Actualizó configuración de feed',
      module: 'Feeds',
      entity: 'Feed',
      entityId: feed.id,
      result: 'Exitoso',
    });

    return feed;
  }

  async remove(id: string, actor: { id: string; email: string; role: string }): Promise<void> {
    const feed = await this.prisma.feed.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Feed no encontrado');
    });

    await this.prisma.feed.delete({ where: { id } });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Eliminó feed institucional',
      module: 'Feeds',
      entity: 'Feed',
      entityId: id,
      details: { slug: feed.slug, name: feed.name },
      result: 'Advertencia',
    });
  }

  async duplicate(id: string, actor: { id: string; email: string; role: string }): Promise<Feed> {
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
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
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
    input: {
      urlOrId: string;
      network: string;
      customContent?: string;
      customMediaUrl?: string;
      customAuthorName?: string;
    },
    actor: { id: string; email: string; role: string },
  ) {
    const feed = await this.prisma.feed.findUniqueOrThrow({ where: { id: feedId } });

    if (feed.network !== 'mixed' && feed.network !== input.network) {
      return {
        success: false,
        message: `Este feed es de ${feed.network.toUpperCase()}; no se pueden agregar publicaciones de otra red social. Cree o use un feed "Multi-Red (Mixto)" si necesita combinar redes.`,
      };
    }

    const { postId, url } = extractPostIdAndDetails(input.urlOrId, input.network);

    if (!postId) {
      return { success: false, message: 'No se pudo identificar un ID o URL válida.' };
    }

    let post = await this.prisma.socialPost.findUnique({
      where: { network_postId: { network: input.network, postId } },
    });

    if (!post) {
      const settings = await this.settings.get();
      const account = (settings.officialAccounts as Record<string, { handle?: string; name?: string; avatarUrl?: string }>)?.[input.network];
      const apiKeys = (settings.apiKeys as Record<string, string>) || {};
      const oembed = input.customContent
        ? null
        : input.network === 'facebook'
          ? await fetchFacebookPost(postId, apiKeys.facebook)
          : input.network === 'x'
            ? await fetchTwitterCard(postId)
            : await fetchOEmbed(input.network, url);

      const mediaThumbOrUrl = input.customMediaUrl || oembed?.thumbnailUrl;

      post = await this.prisma.socialPost.create({
        data: {
          network: input.network,
          postId,
          url,
          authorHandle: account?.handle ?? '@MinfinGT',
          authorName: input.customAuthorName || oembed?.authorName || account?.name || 'Ministerio de Finanzas Públicas',
          authorAvatarUrl: account?.avatarUrl || oembed?.authorAvatarUrl,
          publishedAt: oembed?.publishedAt || formatPublishedAt(new Date()),
          content: input.customContent || oembed?.title || SAMPLE_CONTENT[input.network] || '',
          mediaType: input.network === 'youtube' ? 'video' : 'image',
          mediaThumb: input.network === 'youtube' ? mediaThumbOrUrl : undefined,
          mediaUrl: input.network !== 'youtube' ? mediaThumbOrUrl : undefined,
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

    await this.prisma.feedPost.updateMany({ where: { feedId }, data: { order: { increment: 1 } } });
    await this.prisma.feedPost.create({ data: { feedId, postId: post.id, order: 0 } });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Agregó publicación a feed',
      module: 'Publicaciones',
      entity: 'Feed',
      entityId: feed.id,
      details: { postId, network: input.network },
      result: 'Exitoso',
    });

    return { success: true, message: 'Publicación agregada con éxito.', post };
  }

  async removePost(feedId: string, postId: string, actor: { id: string; email: string; role: string }): Promise<void> {
    await this.prisma.feedPost.delete({ where: { feedId_postId: { feedId, postId } } });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Eliminó publicación del feed',
      module: 'Publicaciones',
      entity: 'Feed',
      entityId: feedId,
      details: { postId },
      result: 'Exitoso',
    });
  }

  async reorderPosts(
    feedId: string,
    orderedPostIds: string[],
    actor: { id: string; email: string; role: string },
  ): Promise<void> {
    await this.prisma.$transaction(
      orderedPostIds.map((postId, index) =>
        this.prisma.feedPost.update({
          where: { feedId_postId: { feedId, postId } },
          data: { order: index },
        }),
      ),
    );

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Reordenó publicaciones',
      module: 'Feeds',
      entity: 'Feed',
      entityId: feedId,
      result: 'Exitoso',
    });
  }

  async updatePostContent(postId: string, content: string, actor: { id: string; email: string; role: string }) {
    const post = await this.prisma.socialPost.update({ where: { id: postId }, data: { content } });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Editó contenido de publicación',
      module: 'Publicaciones',
      entity: 'SocialPost',
      entityId: postId,
      result: 'Exitoso',
    });

    return post;
  }

  // Borra la publicación por completo de la base de datos (no solo su
  // vínculo con un feed) — la cascada quita también sus enlaces en
  // cualquier otro feed. Útil cuando el registro quedó con contenido de
  // muestra desactualizado: al volver a agregar la misma URL, el sistema
  // busca de nuevo el contenido real en lugar de reutilizar el existente.
  async deletePostPermanently(postId: string, actor: { id: string; email: string; role: string }): Promise<void> {
    const post = await this.prisma.socialPost.delete({ where: { id: postId } });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Eliminó publicación permanentemente de la base de datos',
      module: 'Publicaciones',
      entity: 'SocialPost',
      entityId: postId,
      details: { network: post.network, postId: post.postId },
      result: 'Advertencia',
    });
  }
}
