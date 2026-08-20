# Sub-proyecto 2: API de Feeds y Portales — Diseño

Fecha: 2026-08-20
Proyecto: Gestor Centralizado de Redes Sociales — MINFIN

## Contexto

Sub-proyecto 1 (mergeado) dejó `PrismaModule`, `AuthModule`, `UsersModule`, `RolesModule`,
`AuditModule`, `CommonModule` (guards `JwtAuthGuard`/`RolesGuard`, decorator `@Roles`, filtro de
excepciones) funcionando en `/backend`. Este sub-proyecto añade los módulos de negocio que el
mock de `frontend/src/context/AppContext.tsx` ya simula: feeds, publicaciones sociales y
portales WordPress, usando `frontend/src/types.ts` (`Feed`, `SocialPost`, `WordPressPortal`,
`SystemSettings`) como contrato de referencia — mismos nombres de campo, mismo comportamiento
observable donde sea razonable en un backend real.

Este es el sub-proyecto 2 de 5:
1. Base del backend (completo)
2. **API de Feeds y Portales** (este documento)
3. Integración del frontend con la API real
4. Plugin de WordPress
5. Docker Compose + env + README + pruebas de integración

## Alcance de este sub-proyecto

- `FeedsModule`: CRUD de feeds, vinculación/desvinculación/reordenamiento de publicaciones
  dentro de un feed, edición de contenido de una publicación.
- `PortalsModule`: listado de portales WordPress, asignación de feeds a portales, sincronización
  global (webhook stub), prueba de conexión individual (stub) — la integración HTTP real con el
  plugin WordPress se implementa en el sub-proyecto 4; aquí se deja la superficie de API y el
  modelo de datos.
- `SettingsModule`: lectura/actualización de la configuración institucional única
  (`SystemSettings`).
- Toda mutación queda auditada vía `AuditService.log` (ya existente), igual que
  `logAudit()` en el frontend.

Fuera de alcance: conexión real del frontend a esta API (sub-proyecto 3), plugin WordPress real
(sub-proyecto 4), scraping/OAuth real contra redes sociales (no existe en el mock tampoco — se
mantiene la generación de contenido de muestra que ya usa `AppContext.addPost`).

## Modelo de datos (Prisma, añadido a `schema.prisma`)

El mock frontend guarda `postIds: string[]` en `Feed` y usa el orden del arreglo como orden de
publicación. En Postgres relacional esto se modela con una tabla puente `FeedPost` que lleva el
campo `order` explícito — evita reescribir arreglos completos en cada reordenamiento y permite
que una publicación pertenezca a más de un feed (igual que el mock, donde `posts` es una lista
global independiente de `feeds`).

```prisma
model SocialPost {
  id            String   @id @default(uuid())
  network       String   // SocialNetworkType
  postId        String   // ID original de la red social
  url           String
  authorHandle  String
  authorName    String
  publishedAt   String
  content       String
  mediaType     String   // text | image | video | album | carousel
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
  id                 String    @id @default(uuid())
  slug               String    @unique
  name               String
  description        String
  network            String    // SocialNetworkType | 'mixed'
  status             String    @default("active") // active | draft | paused
  layoutDefault      String    @default("grid")
  maxItemsDefault    Int       @default(6)
  showMetrics        Boolean   @default(true)
  showMedia          Boolean   @default(true)
  autoRefreshMinutes Int       @default(5)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
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
  id               String    @id @default(uuid())
  name             String
  domain           String    @unique
  category         String    // Institucional | Transparencia | Finanzas | Sistemas | Direcciones
  connectionStatus String    @default("connected") // connected | syncing | warning | error
  ipAddress        String
  wpVersion        String
  pluginVersion    String
  lastSyncAt       DateTime  @default(now())
  tokenValid       Boolean   @default(true)
  webhookEnabled   Boolean   @default(true)
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

`Feed.postIds` (frontend) se deriva del arreglo `posts` ordenado de cada `Feed` en la respuesta
de la API — el DTO de salida de `GET /feeds/:id` incluye `posts: SocialPost[]` ya ordenados por
`FeedPost.order`, y `postIds` se puede derivar en el frontend en sub-proyecto 3 con `.map(p =>
p.id)`. La API no expone `postIds` como columna propia.

`SystemSettings` es una tabla de una sola fila (`id = 'default'`), como `WHERE id = 'default'`
siempre; se crea vía seed/upsert, nunca se inserta una segunda fila.

## Módulos NestJS

- `FeedsModule` — `FeedsService`, `FeedsController` (`/feeds`).
- `PortalsModule` — `PortalsService`, `PortalsController` (`/portals`).
- `SettingsModule` — `SettingsService`, `SettingsController` (`/settings`).

Todos importan `AuditModule` y `CommonModule` (para `@Roles`/guards), igual que `UsersModule` en
sub-proyecto 1.

## Endpoints y control de acceso

Roles: `admin`, `editor`, `auditor`, `viewer` (definidos en sub-proyecto 1).
Regla general: lectura abierta a los 4 roles autenticados; escritura limitada a `admin` y
`editor`; operaciones de infraestructura de portales (`sync`, `test-connection`, asignación) y
configuración del sistema limitadas a `admin`.

| Método & ruta | Roles | Servicio |
|---|---|---|
| `GET /feeds` | todos | `FeedsService.findAll` |
| `GET /feeds/:id` | todos | `FeedsService.findOne` |
| `POST /feeds` | admin, editor | `FeedsService.create` |
| `PATCH /feeds/:id` | admin, editor | `FeedsService.update` |
| `DELETE /feeds/:id` | admin, editor | `FeedsService.remove` |
| `POST /feeds/:id/duplicate` | admin, editor | `FeedsService.duplicate` |
| `POST /feeds/:id/posts` | admin, editor | `FeedsService.addPost` |
| `DELETE /feeds/:id/posts/:postId` | admin, editor | `FeedsService.removePost` |
| `PATCH /feeds/:id/posts/reorder` | admin, editor | `FeedsService.reorderPosts` |
| `PATCH /posts/:id` | admin, editor | `FeedsService.updatePostContent` |
| `GET /portals` | todos | `PortalsService.findAll` |
| `PATCH /feeds/:id/portals` | admin | `PortalsService.assignFeedToPortals` |
| `POST /feeds/:id/portals/assign-all` | admin | `PortalsService.batchAssignFeedToAllPortals` |
| `POST /portals/sync-all` | admin | `PortalsService.syncAll` |
| `POST /portals/:id/test-connection` | admin | `PortalsService.testConnection` |
| `GET /settings` | todos | `SettingsService.get` |
| `PATCH /settings` | admin | `SettingsService.update` |

Todos los endpoints llevan `@UseGuards(JwtAuthGuard, RolesGuard)`.

## Comportamiento de negocio (paridad con el mock)

- `FeedsService.addPost(feedId, { urlOrId, network, customContent })` reutiliza el mismo
  algoritmo de extracción de ID/URL por red social que `extractPostIdAndDetails` en
  `AppContext.tsx` (regex por red: X, Instagram, YouTube, Facebook, LinkedIn; TikTok cae al
  input crudo). Si ya existe un `SocialPost` con el mismo `(network, postId)`, se reutiliza (no
  se duplica); si no, se crea uno nuevo con contenido de muestra generado igual que el mock,
  usando `SystemSettings.officialAccounts[network]` para `authorHandle`/`authorName` cuando
  existan. Este es un placeholder de datos de demostración — igual al mock — no scraping real;
  la integración con APIs sociales reales queda fuera de alcance de todo el plan de 5
  sub-proyectos.
- `reorderPosts` reescribe el campo `order` de las filas `FeedPost` del feed a partir de un
  arreglo de IDs de publicación en el nuevo orden (equivalente a `reorderPostsInFeed` del mock).
- `PortalsService.syncAll` marca todos los portales `connectionStatus = 'syncing'`, espera una
  operación simulada (sin `setTimeout` de UI; en backend se resuelve inmediato) y los deja en
  `connected` con `lastSyncAt = now()` — el webhook HTTP real a WordPress se conecta en
  sub-proyecto 4; por ahora es una simulación coherente con el mock (`syncAllPortals`).
- `PortalsService.testConnection(portalId)` simula igual que `testPortalConnection` del mock:
  pasa a `syncing`, luego `connected` con `lastSyncAt` actualizado, devuelve `true`.
- Toda mutación registra auditoría con el mismo texto de `action`/`module` que usa el mock
  (`'Feeds' | 'Publicaciones' | 'Portales' | 'Configuración'`), reutilizando
  `AuditService.log` de sub-proyecto 1.

## Seed

`backend/prisma/seed.ts` (existente, de sub-proyecto 1) se extiende para además crear:
- Una fila `SystemSettings` con `id: 'default'` si no existe, usando los mismos valores por
  defecto que `INITIAL_SETTINGS` en `frontend/src/data/initialData.ts` (`webhookSecret` generado
  con `crypto.randomBytes`, no hardcodeado).
- No se siembran portales ni feeds de ejemplo — esos se crean vía API una vez el frontend se
  conecte (sub-proyecto 3); mantener el seed mínimo evita datos de demostración en producción.

## Testing

Jest + `@nestjs/testing`, mismo patrón que sub-proyecto 1:
- Unitarias: `FeedsService` (crear, actualizar, eliminar, duplicar, addPost con reutilización de
  publicación existente, reorderPosts), `PortalsService` (assignFeedToPortals,
  batchAssignFeedToAllPortals), `SettingsService` (upsert de fila única).
- E2E: flujo `POST /feeds` → `POST /feeds/:id/posts` → `GET /feeds/:id` (verifica orden y
  contenido) → `PATCH /feeds/:id/portals` → `GET /portals`, todo autenticado con JWT emitido por
  el flujo de sub-proyecto 1.

## Fuera de alcance (se aborda en sub-proyectos posteriores)

- Conexión del frontend React a esta API real (sub-proyecto 3).
- Plugin de WordPress y webhook HTTP real hacia portales (sub-proyecto 4).
- `docker-compose.yml` completo y README final (sub-proyecto 5).
