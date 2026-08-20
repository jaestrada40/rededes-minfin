# API de Feeds y Portales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `FeedsModule`, `PortalsModule`, and `SettingsModule` to the existing NestJS backend
so feeds, social posts, WordPress portal metadata, and institutional settings are persisted in
Postgres and exposed via role-guarded REST endpoints, mirroring `AppContext.tsx`'s mock behavior.

**Architecture:** Three new Nest modules built on the sub-project 1 foundation
(`PrismaModule`, `AuditModule`, `CommonModule` guards/decorators). `Feed`↔`SocialPost` and
`Feed`↔`WordPressPortal` are modeled as explicit join tables (`FeedPost` with an `order` column,
`FeedPortal`) rather than the mock's `postIds: string[]` arrays, so reordering and multi-feed
post reuse map onto normal relational updates.

**Tech Stack:** NestJS 10, Prisma ORM, PostgreSQL, `class-validator` DTOs, Jest +
`@nestjs/testing` + `supertest` — same stack as sub-project 1, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-feeds-portales-api-design.md`

## Global Constraints

- New modules import `AuditModule` and `CommonModule` and guard every endpoint with
  `@UseGuards(JwtAuthGuard, RolesGuard)` — spec "Endpoints y control de acceso".
- Read endpoints allow all 4 roles (`admin`, `editor`, `auditor`, `viewer`); writes to
  feeds/posts allow `admin`+`editor`; portal operations and settings writes are `admin`-only —
  spec table.
- `Feed`↔`SocialPost` linkage uses the `FeedPost` join table with an `order` int column, not a
  `postIds` string array — spec "Modelo de datos".
- `SocialPost` uniqueness is `@@unique([network, postId])`; `addPost` reuses an existing row
  instead of duplicating — spec "Comportamiento de negocio".
- `SystemSettings` is a single row with fixed `id: 'default'`, upserted, never a second row —
  spec "Modelo de datos".
- Every mutation calls `AuditService.log` with the same `module` values used by the mock
  (`'Feeds' | 'Publicaciones' | 'Portales' | 'Configuración'`) — spec "Comportamiento de
  negocio".
- `PortalsService.syncAll` / `testConnection` are synchronous simulations (no real HTTP to
  WordPress) — spec "Comportamiento de negocio"; real webhook integration is sub-project 4.

---

## File Structure

```
backend/
  prisma/
    schema.prisma            # modify: add SocialPost, Feed, FeedPost, WordPressPortal, FeedPortal, SystemSettings
    seed.ts                  # modify: seed default SystemSettings row
  src/
    feeds/
      dto/create-feed.dto.ts
      dto/update-feed.dto.ts
      dto/add-post.dto.ts
      dto/reorder-posts.dto.ts
      dto/update-post-content.dto.ts
      feeds.service.ts
      feeds.controller.ts
      feeds.module.ts
    portals/
      dto/assign-portals.dto.ts
      portals.service.ts
      portals.controller.ts
      portals.module.ts
    settings/
      dto/update-settings.dto.ts
      settings.service.ts
      settings.controller.ts
      settings.module.ts
    app.module.ts             # modify: register FeedsModule, PortalsModule, SettingsModule
  test/
    feeds.e2e-spec.ts
```

---

### Task 1: Prisma schema — Feed, SocialPost, FeedPost, WordPressPortal, FeedPortal, SystemSettings

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Produces: Prisma Client models `SocialPost`, `Feed`, `FeedPost`, `WordPressPortal`,
  `FeedPortal`, `SystemSettings` — exact field names used by every later task.

- [ ] **Step 1: Append the new models to `backend/prisma/schema.prisma`**

```prisma
model SocialPost {
  id            String   @id @default(uuid())
  network       String
  postId        String
  url           String
  authorHandle  String
  authorName    String
  publishedAt   String
  content       String
  mediaType     String
  mediaUrl      String?
  mediaThumb    String?
  videoDuration String?
  stats         Json?
  isValidated   Boolean  @default(true)
  addedAt       DateTime @default(now())
  addedBy       String
  feedLinks     FeedPost[]

  @@unique([network, postId])
}

model Feed {
  id                 String     @id @default(uuid())
  slug               String     @unique
  name               String
  description        String
  network            String
  status             String     @default("active")
  layoutDefault      String     @default("grid")
  maxItemsDefault    Int        @default(6)
  showMetrics        Boolean    @default(true)
  showMedia          Boolean    @default(true)
  autoRefreshMinutes Int        @default(5)
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt
  updatedBy          String
  posts              FeedPost[]
  portals            FeedPortal[]
}

model FeedPost {
  feedId String
  postId String
  order  Int
  feed   Feed       @relation(fields: [feedId], references: [id], onDelete: Cascade)
  post   SocialPost @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@id([feedId, postId])
}

model WordPressPortal {
  id               String       @id @default(uuid())
  name             String
  domain           String       @unique
  category         String
  connectionStatus String       @default("connected")
  ipAddress        String
  wpVersion        String
  pluginVersion    String
  lastSyncAt       DateTime     @default(now())
  tokenValid       Boolean      @default(true)
  webhookEnabled   Boolean      @default(true)
  description      String
  feeds            FeedPortal[]
}

model FeedPortal {
  feedId   String
  portalId String
  feed     Feed            @relation(fields: [feedId], references: [id], onDelete: Cascade)
  portal   WordPressPortal @relation(fields: [portalId], references: [id], onDelete: Cascade)

  @@id([feedId, portalId])
}

model SystemSettings {
  id                      String   @id @default("default")
  institutionName         String   @default("Ministerio de Finanzas Públicas")
  shortcodeTag            String   @default("minfin_social_feed")
  apiCacheDurationSeconds Int      @default(300)
  webhookSecret           String
  autoInvalidateCache     Boolean  @default(true)
  allowedCorsDomains      String[]
  officialAccounts        Json
  contactSupportEmail     String   @default("soporte.dti@minfin.gob.gt")
  maintenanceMode         Boolean  @default(false)
}
```

- [ ] **Step 2: Run the migration**

Run: `cd backend && npx prisma migrate dev --name feeds-portals-settings`
Expected: migration folder created, Prisma Client regenerated, no errors.

- [ ] **Step 3: Extend `backend/prisma/seed.ts` to upsert the default `SystemSettings` row**

Add near the end of `main()`, before the final `console.log`:

```typescript
import * as crypto from 'crypto';
```

(add to the top imports alongside `bcrypt`), then add before `console.log(\`Seed completo...\`)`:

```typescript
  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      webhookSecret: crypto.randomBytes(32).toString('hex'),
      allowedCorsDomains: [],
      officialAccounts: {},
    },
  });
```

- [ ] **Step 4: Run the seed and verify**

Run: `cd backend && npx prisma db seed`
Expected: no errors; `SystemSettings` table has exactly one row with `id = 'default'`.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma
git commit -m "feat: add Prisma models for feeds, posts, portals, and settings"
```

---

### Task 2: FeedsService — CRUD (create, update, remove, duplicate, findAll, findOne)

**Files:**
- Create: `backend/src/feeds/dto/create-feed.dto.ts`
- Create: `backend/src/feeds/dto/update-feed.dto.ts`
- Create: `backend/src/feeds/feeds.service.ts`
- Test: `backend/src/feeds/feeds.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 4 of sub-project 1), `AuditService.log` (sub-project 1).
- Produces: `FeedsService.create(dto: CreateFeedDto, actor: { email: string }): Promise<Feed>`,
  `FeedsService.findAll(): Promise<Feed[]>`,
  `FeedsService.findOne(id: string): Promise<Feed & { posts: (FeedPost & { post: SocialPost })[] }>`,
  `FeedsService.update(id: string, dto: UpdateFeedDto, actor: { email: string }): Promise<Feed>`,
  `FeedsService.remove(id: string, actor: { email: string }): Promise<void>`,
  `FeedsService.duplicate(id: string, actor: { email: string }): Promise<Feed>` — consumed by
  `FeedsController` (Task 6).

- [ ] **Step 1: Write `backend/src/feeds/dto/create-feed.dto.ts`**

```typescript
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateFeedDto {
  @IsOptional() @IsString() slug?: string;
  @IsString() name: string;
  @IsString() description: string;
  @IsString() network: string;
  @IsOptional() @IsIn(['active', 'draft', 'paused']) status?: string;
  @IsOptional() @IsIn(['grid', 'list', 'carousel', 'single']) layoutDefault?: string;
  @IsOptional() @IsInt() @Min(1) maxItemsDefault?: number;
  @IsOptional() @IsBoolean() showMetrics?: boolean;
  @IsOptional() @IsBoolean() showMedia?: boolean;
  @IsOptional() @IsInt() @Min(0) autoRefreshMinutes?: number;
}
```

- [ ] **Step 2: Write `backend/src/feeds/dto/update-feed.dto.ts`**

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateFeedDto } from './create-feed.dto';

export class UpdateFeedDto extends PartialType(CreateFeedDto) {}
```

Run: `cd backend && npm install @nestjs/mapped-types` (only if not already a dependency — check
`backend/package.json` first).

- [ ] **Step 3: Write the failing test `backend/src/feeds/feeds.service.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { FeedsService } from './feeds.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('FeedsService', () => {
  let service: FeedsService;
  const feedRow = {
    id: 'f1',
    slug: 'x-comunicados',
    name: 'X – Comunicados',
    description: 'desc',
    network: 'x',
    status: 'active',
    layoutDefault: 'grid',
    maxItemsDefault: 6,
    showMetrics: true,
    showMedia: true,
    autoRefreshMinutes: 5,
    updatedBy: 'a@minfin.gob.gt',
  };
  const prismaMock = {
    feed: {
      create: jest.fn().mockResolvedValue(feedRow),
      findMany: jest.fn().mockResolvedValue([feedRow]),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...feedRow, posts: [], portals: [] }),
      update: jest.fn().mockResolvedValue(feedRow),
      delete: jest.fn().mockResolvedValue(feedRow),
    },
    feedPost: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn() },
  };
  const auditMock = { log: jest.fn() };
  const actor = { email: 'a@minfin.gob.gt' };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeedsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = moduleRef.get(FeedsService);
  });

  it('creates a feed and derives a slug from the name when none is given', async () => {
    const feed = await service.create(
      { name: 'X – Comunicados', description: 'desc', network: 'x' },
      actor,
    );
    expect(prismaMock.feed.create).toHaveBeenCalled();
    expect(feed.slug).toBe('x-comunicados');
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'Feeds', result: 'Exitoso' }),
    );
  });

  it('duplicates a feed with a new slug', async () => {
    const feed = await service.duplicate('f1', actor);
    expect(feed).toBeDefined();
    expect(prismaMock.feed.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && npx jest src/feeds/feeds.service.spec.ts`
Expected: FAIL — `Cannot find module './feeds.service'`.

- [ ] **Step 5: Write `backend/src/feeds/feeds.service.ts`**

```typescript
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npx jest src/feeds/feeds.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/feeds
git commit -m "feat: add FeedsService CRUD (create, update, remove, duplicate, find)"
```

---

### Task 3: FeedsService — post linking (addPost, removePost, reorderPosts, updatePostContent)

**Files:**
- Create: `backend/src/feeds/dto/add-post.dto.ts`
- Create: `backend/src/feeds/dto/reorder-posts.dto.ts`
- Create: `backend/src/feeds/dto/update-post-content.dto.ts`
- Modify: `backend/src/feeds/feeds.service.ts`
- Test: `backend/src/feeds/feeds.service.spec.ts` (append)

**Interfaces:**
- Consumes: `SettingsService.get` (Task 5, for `officialAccounts` lookup).
- Produces: `FeedsService.addPost(feedId: string, input: { urlOrId: string; network: string; customContent?: string }, actor: { email: string }): Promise<{ success: boolean; message: string; post?: SocialPost }>`,
  `FeedsService.removePost(feedId: string, postId: string, actor: { email: string }): Promise<void>`,
  `FeedsService.reorderPosts(feedId: string, orderedPostIds: string[], actor: { email: string }): Promise<void>`,
  `FeedsService.updatePostContent(postId: string, content: string, actor: { email: string }): Promise<SocialPost>` —
  consumed by `FeedsController` (Task 6).

- [ ] **Step 1: Write `backend/src/feeds/dto/add-post.dto.ts`**

```typescript
import { IsOptional, IsString } from 'class-validator';

export class AddPostDto {
  @IsString() urlOrId: string;
  @IsString() network: string;
  @IsOptional() @IsString() customContent?: string;
}
```

- [ ] **Step 2: Write `backend/src/feeds/dto/reorder-posts.dto.ts`**

```typescript
import { IsArray, IsString } from 'class-validator';

export class ReorderPostsDto {
  @IsArray() @IsString({ each: true }) orderedPostIds: string[];
}
```

- [ ] **Step 3: Write `backend/src/feeds/dto/update-post-content.dto.ts`**

```typescript
import { IsString } from 'class-validator';

export class UpdatePostContentDto {
  @IsString() content: string;
}
```

- [ ] **Step 4: Append the failing tests to `backend/src/feeds/feeds.service.spec.ts`**

Add to the existing `prismaMock`:

```typescript
    socialPost: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'p1', network: 'x', postId: '123' }),
      update: jest.fn().mockResolvedValue({ id: 'p1', content: 'nuevo' }),
    },
```

and to `feedPost`:

```typescript
    feedPost: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
```

and add to the `SettingsService` provider list a mock: `{ provide: SettingsService, useValue: { get: jest.fn().mockResolvedValue({ officialAccounts: {} }) } }`
(import `SettingsService` from `'../settings/settings.service'`), then add new `it` blocks:

```typescript
  it('adds a new post to a feed by extracting the ID from an X URL', async () => {
    const result = await service.addPost(
      'f1',
      { urlOrId: 'https://x.com/MinfinGT/status/1234567890', network: 'x' },
      actor,
    );
    expect(result.success).toBe(true);
    expect(prismaMock.socialPost.create).toHaveBeenCalled();
  });

  it('reorders posts by writing the order column for each FeedPost row', async () => {
    await service.reorderPosts('f1', ['p2', 'p1'], actor);
    expect(prismaMock.feedPost.update).toHaveBeenCalledTimes(2);
  });
```

- [ ] **Step 5: Run tests to verify the new ones fail**

Run: `cd backend && npx jest src/feeds/feeds.service.spec.ts`
Expected: FAIL — `service.addPost is not a function`.

- [ ] **Step 6: Add the extraction helper and new methods to `backend/src/feeds/feeds.service.ts`**

Add near the top of the file, after the `slugify` function:

```typescript
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
```

Add the `SettingsService` import and inject it in the constructor:

```typescript
import { SettingsService } from '../settings/settings.service';
```

```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}
```

Append the new methods at the end of the class, before the closing `}`:

```typescript
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
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && npx jest src/feeds/feeds.service.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/src/feeds
git commit -m "feat: add post linking to FeedsService (addPost, removePost, reorder)"
```

---

### Task 4: SettingsModule

**Files:**
- Create: `backend/src/settings/dto/update-settings.dto.ts`
- Create: `backend/src/settings/settings.service.ts`
- Create: `backend/src/settings/settings.controller.ts`
- Create: `backend/src/settings/settings.module.ts`
- Test: `backend/src/settings/settings.service.spec.ts`

**Interfaces:**
- Produces: `SettingsService.get(): Promise<SystemSettings>`,
  `SettingsService.update(dto: UpdateSettingsDto, actor: { email: string }): Promise<SystemSettings>` —
  consumed by `FeedsService` (Task 3) and `SettingsController`.

Built first structurally so `FeedsService` (Task 3) can inject it, but implemented here with its
own tests; Task 3 only depends on the method signature, not the internals.

- [ ] **Step 1: Write `backend/src/settings/dto/update-settings.dto.ts`**

```typescript
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() institutionName?: string;
  @IsOptional() @IsString() shortcodeTag?: string;
  @IsOptional() @IsInt() @Min(0) apiCacheDurationSeconds?: number;
  @IsOptional() @IsBoolean() autoInvalidateCache?: boolean;
  @IsOptional() allowedCorsDomains?: string[];
  @IsOptional() officialAccounts?: Record<string, unknown>;
  @IsOptional() @IsEmail() contactSupportEmail?: string;
  @IsOptional() @IsBoolean() maintenanceMode?: boolean;
}
```

- [ ] **Step 2: Write the failing test `backend/src/settings/settings.service.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('SettingsService', () => {
  let service: SettingsService;
  const row = { id: 'default', institutionName: 'MINFIN', maintenanceMode: false };
  const prismaMock = {
    systemSettings: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({ ...row, maintenanceMode: true }),
    },
  };
  const auditMock = { log: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = moduleRef.get(SettingsService);
  });

  it('returns the single settings row', async () => {
    const settings = await service.get();
    expect(settings.id).toBe('default');
  });

  it('updates the settings row and audits the change', async () => {
    const settings = await service.update({ maintenanceMode: true }, { email: 'a@minfin.gob.gt' });
    expect(settings.maintenanceMode).toBe(true);
    expect(auditMock.log).toHaveBeenCalledWith(expect.objectContaining({ module: 'Configuración' }));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest src/settings/settings.service.spec.ts`
Expected: FAIL — `Cannot find module './settings.service'`.

- [ ] **Step 4: Write `backend/src/settings/settings.service.ts`**

```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/settings/settings.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write `backend/src/settings/settings.controller.ts`**

```typescript
import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Roles('admin', 'editor', 'auditor', 'viewer')
  @Get()
  get() {
    return this.settings.get();
  }

  @Roles('admin')
  @Patch()
  update(@Body() dto: UpdateSettingsDto, @Req() req: Request & { user: { email: string } }) {
    return this.settings.update(dto, req.user);
  }
}
```

- [ ] **Step 7: Write `backend/src/settings/settings.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [AuditModule, CommonModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/settings
git commit -m "feat: add SettingsModule for institutional configuration"
```

---

### Task 5: Wire SettingsModule into FeedsModule; write FeedsController and FeedsModule

**Files:**
- Create: `backend/src/feeds/feeds.controller.ts`
- Create: `backend/src/feeds/feeds.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `FeedsService` (Tasks 2–3), `SettingsModule` (Task 4, for DI availability).
- Produces: HTTP surface `/feeds`, `/feeds/:id`, `/feeds/:id/posts`,
  `/feeds/:id/posts/reorder`, `/posts/:id` — matches spec's endpoint table exactly.

- [ ] **Step 1: Write `backend/src/feeds/feeds.controller.ts`**

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FeedsService } from './feeds.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { AddPostDto } from './dto/add-post.dto';
import { ReorderPostsDto } from './dto/reorder-posts.dto';
import { UpdatePostContentDto } from './dto/update-post-content.dto';

type AuthedRequest = Request & { user: { id: string; email: string; role: string } };

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Roles('admin', 'editor', 'auditor', 'viewer')
  @Get('feeds')
  findAll() {
    return this.feeds.findAll();
  }

  @Roles('admin', 'editor', 'auditor', 'viewer')
  @Get('feeds/:id')
  findOne(@Param('id') id: string) {
    return this.feeds.findOne(id);
  }

  @Roles('admin', 'editor')
  @Post('feeds')
  create(@Body() dto: CreateFeedDto, @Req() req: AuthedRequest) {
    return this.feeds.create(dto, req.user);
  }

  @Roles('admin', 'editor')
  @Patch('feeds/:id')
  update(@Param('id') id: string, @Body() dto: UpdateFeedDto, @Req() req: AuthedRequest) {
    return this.feeds.update(id, dto, req.user);
  }

  @Roles('admin', 'editor')
  @Delete('feeds/:id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.feeds.remove(id, req.user);
  }

  @Roles('admin', 'editor')
  @Post('feeds/:id/duplicate')
  duplicate(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.feeds.duplicate(id, req.user);
  }

  @Roles('admin', 'editor')
  @Post('feeds/:id/posts')
  addPost(@Param('id') id: string, @Body() dto: AddPostDto, @Req() req: AuthedRequest) {
    return this.feeds.addPost(id, dto, req.user);
  }

  @Roles('admin', 'editor')
  @Delete('feeds/:id/posts/:postId')
  removePost(@Param('id') id: string, @Param('postId') postId: string, @Req() req: AuthedRequest) {
    return this.feeds.removePost(id, postId, req.user);
  }

  @Roles('admin', 'editor')
  @Patch('feeds/:id/posts/reorder')
  reorder(@Param('id') id: string, @Body() dto: ReorderPostsDto, @Req() req: AuthedRequest) {
    return this.feeds.reorderPosts(id, dto.orderedPostIds, req.user);
  }

  @Roles('admin', 'editor')
  @Patch('posts/:id')
  updatePostContent(@Param('id') id: string, @Body() dto: UpdatePostContentDto, @Req() req: AuthedRequest) {
    return this.feeds.updatePostContent(id, dto.content, req.user);
  }
}
```

- [ ] **Step 2: Write `backend/src/feeds/feeds.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { FeedsService } from './feeds.service';
import { FeedsController } from './feeds.controller';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AuditModule, CommonModule, SettingsModule],
  providers: [FeedsService],
  controllers: [FeedsController],
  exports: [FeedsService],
})
export class FeedsModule {}
```

- [ ] **Step 3: Register `FeedsModule` and `SettingsModule` in `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';
import { FeedsModule } from './feeds/feeds.module';

@Module({
  imports: [
    PrismaModule,
    RolesModule,
    UsersModule,
    AuditModule,
    AuthModule,
    SettingsModule,
    FeedsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Verify build**

Run: `cd backend && npm run build`
Expected: compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/feeds backend/src/app.module.ts
git commit -m "feat: add FeedsController and wire FeedsModule/SettingsModule into AppModule"
```

---

### Task 6: PortalsModule

**Files:**
- Create: `backend/src/portals/dto/assign-portals.dto.ts`
- Create: `backend/src/portals/portals.service.ts`
- Create: `backend/src/portals/portals.controller.ts`
- Create: `backend/src/portals/portals.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/portals/portals.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `AuditService.log`.
- Produces: `PortalsService.findAll(): Promise<WordPressPortal[]>`,
  `PortalsService.assignFeedToPortals(feedId: string, portalIds: string[], actor: { email: string }): Promise<void>`,
  `PortalsService.batchAssignFeedToAllPortals(feedId: string, actor: { email: string }): Promise<void>`,
  `PortalsService.syncAll(actor: { email: string }): Promise<void>`,
  `PortalsService.testConnection(portalId: string, actor: { email: string }): Promise<boolean>`.

- [ ] **Step 1: Write `backend/src/portals/dto/assign-portals.dto.ts`**

```typescript
import { IsArray, IsString } from 'class-validator';

export class AssignPortalsDto {
  @IsArray() @IsString({ each: true }) portalIds: string[];
}
```

- [ ] **Step 2: Write the failing test `backend/src/portals/portals.service.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { PortalsService } from './portals.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('PortalsService', () => {
  let service: PortalsService;
  const prismaMock = {
    wordPressPortal: {
      findMany: jest.fn().mockResolvedValue([{ id: 'wp1' }, { id: 'wp2' }]),
      updateMany: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ id: 'wp1', connectionStatus: 'connected' }),
    },
    feedPortal: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
  };
  const auditMock = { log: jest.fn() };
  const actor = { email: 'a@minfin.gob.gt' };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PortalsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = moduleRef.get(PortalsService);
  });

  it('assigns a feed to the given portals, replacing prior assignments', async () => {
    await service.assignFeedToPortals('f1', ['wp1', 'wp2'], actor);
    expect(prismaMock.feedPortal.deleteMany).toHaveBeenCalledWith({ where: { feedId: 'f1' } });
    expect(prismaMock.feedPortal.createMany).toHaveBeenCalledWith({
      data: [
        { feedId: 'f1', portalId: 'wp1' },
        { feedId: 'f1', portalId: 'wp2' },
      ],
    });
  });

  it('assigns a feed to every portal in batchAssignFeedToAllPortals', async () => {
    await service.batchAssignFeedToAllPortals('f1', actor);
    expect(prismaMock.wordPressPortal.findMany).toHaveBeenCalled();
    expect(prismaMock.feedPortal.createMany).toHaveBeenCalledWith({
      data: [
        { feedId: 'f1', portalId: 'wp1' },
        { feedId: 'f1', portalId: 'wp2' },
      ],
    });
  });

  it('marks all portals connected after syncAll', async () => {
    await service.syncAll(actor);
    expect(prismaMock.wordPressPortal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ connectionStatus: 'connected' }) }),
    );
  });

  it('tests a single portal connection and returns true', async () => {
    const result = await service.testConnection('wp1', actor);
    expect(result).toBe(true);
    expect(prismaMock.wordPressPortal.update).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest src/portals/portals.service.spec.ts`
Expected: FAIL — `Cannot find module './portals.service'`.

- [ ] **Step 4: Write `backend/src/portals/portals.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WordPressPortal } from '@prisma/client';

@Injectable()
export class PortalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(): Promise<WordPressPortal[]> {
    return this.prisma.wordPressPortal.findMany({ orderBy: { name: 'asc' } });
  }

  async assignFeedToPortals(feedId: string, portalIds: string[], actor: { email: string }): Promise<void> {
    await this.prisma.feedPortal.deleteMany({ where: { feedId } });
    await this.prisma.feedPortal.createMany({
      data: portalIds.map((portalId) => ({ feedId, portalId })),
    });

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Asignó feed a portales WordPress',
      module: 'Portales',
      entity: 'Feed',
      entityId: feedId,
      details: { portalCount: portalIds.length },
      result: 'Exitoso',
    });
  }

  async batchAssignFeedToAllPortals(feedId: string, actor: { email: string }): Promise<void> {
    const portals = await this.prisma.wordPressPortal.findMany();
    await this.assignFeedToPortals(feedId, portals.map((p) => p.id), actor);
  }

  async syncAll(actor: { email: string }): Promise<void> {
    await this.prisma.wordPressPortal.updateMany({
      data: { connectionStatus: 'connected', lastSyncAt: new Date(), tokenValid: true },
    });

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Sincronización global ejecutada',
      module: 'Portales',
      result: 'Exitoso',
    });
  }

  async testConnection(portalId: string, actor: { email: string }): Promise<boolean> {
    const portal = await this.prisma.wordPressPortal.update({
      where: { id: portalId },
      data: { connectionStatus: 'connected', lastSyncAt: new Date() },
    });

    await this.audit.log({
      userEmail: actor.email,
      userRole: 'desconocido',
      action: 'Prueba de conexión con portal',
      module: 'Portales',
      entity: 'WordPressPortal',
      entityId: portal.id,
      result: 'Exitoso',
    });

    return true;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/portals/portals.service.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write `backend/src/portals/portals.controller.ts`**

```typescript
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PortalsService } from './portals.service';
import { AssignPortalsDto } from './dto/assign-portals.dto';

type AuthedRequest = Request & { user: { email: string } };

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PortalsController {
  constructor(private readonly portals: PortalsService) {}

  @Roles('admin', 'editor', 'auditor', 'viewer')
  @Get('portals')
  findAll() {
    return this.portals.findAll();
  }

  @Roles('admin')
  @Patch('feeds/:id/portals')
  assign(@Param('id') id: string, @Body() dto: AssignPortalsDto, @Req() req: AuthedRequest) {
    return this.portals.assignFeedToPortals(id, dto.portalIds, req.user);
  }

  @Roles('admin')
  @Post('feeds/:id/portals/assign-all')
  assignAll(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.portals.batchAssignFeedToAllPortals(id, req.user);
  }

  @Roles('admin')
  @Post('portals/sync-all')
  syncAll(@Req() req: AuthedRequest) {
    return this.portals.syncAll(req.user);
  }

  @Roles('admin')
  @Post('portals/:id/test-connection')
  testConnection(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.portals.testConnection(id, req.user);
  }
}
```

- [ ] **Step 7: Write `backend/src/portals/portals.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { PortalsService } from './portals.service';
import { PortalsController } from './portals.controller';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [AuditModule, CommonModule],
  providers: [PortalsService],
  controllers: [PortalsController],
  exports: [PortalsService],
})
export class PortalsModule {}
```

- [ ] **Step 8: Register `PortalsModule` in `backend/src/app.module.ts`**

Add `import { PortalsModule } from './portals/portals.module';` and add `PortalsModule` to the
`imports` array alongside `FeedsModule`.

- [ ] **Step 9: Verify build**

Run: `cd backend && npm run build`
Expected: compiles with no errors.

- [ ] **Step 10: Commit**

```bash
git add backend/src/portals backend/src/app.module.ts
git commit -m "feat: add PortalsModule with assignment and connection simulation"
```

---

### Task 7: E2E test — create feed, add post, assign portal, verify order

**Files:**
- Create: `backend/test/feeds.e2e-spec.ts`

**Interfaces:**
- Consumes: full running `AppModule` (all modules through Task 6) against the test database
  configured in sub-project 1 Task 10, plus the auth flow from sub-project 1 to obtain a JWT.

- [ ] **Step 1: Write `backend/test/feeds.e2e-spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Feeds and portals flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = 'e2e-feeds-admin@minfin.gob.gt';
  const password = 'Password123!';
  let accessToken: string;
  let portalId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const role = await prisma.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin' } });
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: 'E2E Feeds Admin', passwordHash: await bcrypt.hash(password, 10), roleId: role.id },
    });
    await prisma.systemSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default', webhookSecret: 'test-secret', allowedCorsDomains: [], officialAccounts: {} },
    });
    const portal = await prisma.wordPressPortal.create({
      data: {
        name: 'Portal E2E',
        domain: `e2e-${Date.now()}.minfin.gob.gt`,
        category: 'Institucional',
        ipAddress: '127.0.0.1',
        wpVersion: '6.5',
        pluginVersion: '2.4.1',
        description: 'Portal de prueba e2e',
      },
    });
    portalId = portal.id;

    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    const setupRes = await request(app.getHttpServer())
      .post('/auth/mfa/setup')
      .send({ setupToken: loginRes.body.setupToken });
    const secret = JSON.parse(Buffer.from(setupRes.body.verifyToken.split('.')[1], 'base64').toString()).secret;
    const code = authenticator.generate(secret);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/mfa/setup/verify')
      .send({ token: setupRes.body.verifyToken, code });
    accessToken = verifyRes.body.accessToken;
  });

  afterAll(async () => {
    await prisma.wordPressPortal.deleteMany({ where: { id: portalId } });
    await prisma.refreshToken.deleteMany({});
    await prisma.mfaSettings.deleteMany({});
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('creates a feed, adds a post, assigns a portal, and returns them in order', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/feeds')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Feed E2E', description: 'desc', network: 'x' })
      .expect(201);
    const feedId = createRes.body.id;

    await request(app.getHttpServer())
      .post(`/feeds/${feedId}/posts`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ urlOrId: 'https://x.com/MinfinGT/status/9988776655', network: 'x' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/feeds/${feedId}/portals`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ portalIds: [portalId] })
      .expect(200);

    const getRes = await request(app.getHttpServer())
      .get(`/feeds/${feedId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(getRes.body.posts).toHaveLength(1);
    expect(getRes.body.posts[0].post.postId).toBe('9988776655');
    expect(getRes.body.portals).toHaveLength(1);
    expect(getRes.body.portals[0].portal.id).toBe(portalId);
  });
});
```

- [ ] **Step 2: Run the e2e test**

Run: `cd backend && DATABASE_URL="postgresql://minfin:minfin@localhost:5433/minfin_social_test?schema=public" JWT_ACCESS_SECRET=test-secret npx jest --config ./test/jest-e2e.json`
Expected: PASS.

- [ ] **Step 3: Full unit suite + build check**

Run: `cd backend && npx jest && npm run build`
Expected: all unit tests pass (sub-project 1 + this sub-project), build succeeds.

- [ ] **Step 4: Commit**

```bash
git add backend/test
git commit -m "test: add e2e coverage for feed creation, post linking, portal assignment"
```

---

## Self-Review Notes

- **Spec coverage:** Prisma schema exactly as specified including join tables (Task 1); all
  three modules and their endpoints (Tasks 4–6); role table honored per-endpoint (`@Roles`
  decorators in Tasks 5–6); `addPost` extraction/sample-content parity with the mock (Task 3);
  `reorderPosts` writing `order` per row (Task 3); portal sync/test-connection simulation
  (Task 6); settings singleton upsert (Task 4); audit logging on every mutation (Tasks 2, 3, 4,
  6); unit + e2e testing (Tasks 2–3, 4, 6, 7) — all covered.
- **Type consistency:** `SettingsService.get()` return type (`SystemSettings`) matches its usage
  in `FeedsService.addPost` (Task 3, reading `.officialAccounts`). `AuditService.log` call shape
  matches the sub-project 1 signature at every call site. `FeedsService` method names/signatures
  defined in Tasks 2–3 match exactly what `FeedsController` (Task 5) calls.
  `PortalsService` method names/signatures from Task 6 match `PortalsController` calls.
- **Out of scope reminder:** frontend API wiring, real WordPress webhook HTTP calls, and the full
  docker-compose are explicitly deferred to sub-projects 3–5 per the spec.
