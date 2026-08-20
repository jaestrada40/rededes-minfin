# Sub-proyecto 1: Base del Backend — Diseño

Fecha: 2026-08-19
Proyecto: Gestor Centralizado de Redes Sociales — MINFIN

## Contexto

El repositorio ya contiene un export de Google Stitch: una app React 19 + TypeScript + Vite
completamente maquetada, con datos mock en `src/data/initialData.ts` y toda la lógica de
negocio (auth simulado, feeds, posts, portales, auditoría) implementada en memoria dentro de
`src/context/AppContext.tsx`, persistida en `localStorage`. Esa lógica sirve como contrato de
referencia fiel para el backend real: los tipos en `src/types.ts` (`UserProfile`, `UserRole`,
`AuditLogEntry`, etc.) y las firmas de las funciones en `AppContextType` describen el
comportamiento esperado del sistema.

Este es el primer sub-proyecto de un plan mayor dividido en 5 partes:
1. **Base del backend** (este documento) — NestJS + Prisma + Auth JWT/MFA + RBAC + Auditoría
2. API de Feeds y Portales
3. Integración del frontend con la API real
4. Plugin de WordPress
5. Docker Compose + env + README + pruebas de integración

## Alcance de este sub-proyecto

Construir el backend NestJS mínimo con autenticación institucional completa (login, JWT +
refresh token con rotación, MFA TOTP obligatorio desde el primer login), gestión de usuarios y
roles, y registro de auditoría persistente. Los módulos de feeds, publicaciones y portales
WordPress se implementan en el sub-proyecto 2.

## Estructura de repositorio

Monorepo:
- `/frontend` — código React/Vite actual, movido tal cual desde la raíz (sin cambios de lógica
  en este sub-proyecto).
- `/backend` — proyecto NestJS + TypeScript + Prisma nuevo.
- `docker-compose.yml` en la raíz, con servicio `postgres` funcional desde este sub-proyecto
  (los servicios `backend`/`frontend` se completan en el sub-proyecto 5).

## Módulos NestJS

- `PrismaModule` (global) — cliente Prisma compartido vía inyección de dependencias.
- `AuthModule` — login, refresh, logout, setup/verificación de MFA, `JwtAuthGuard`,
  `RolesGuard`, `PermissionsGuard`.
- `UsersModule` — CRUD de usuarios, asignación de rol.
- `RolesModule` — roles y permisos; seed de los 4 roles base (`admin`, `editor`, `auditor`,
  `viewer`) coincidiendo con `UserRole` del frontend.
- `AuditModule` — `AuditService` inyectable usado por otros módulos (equivalente en backend a
  `logAudit` de `AppContext.tsx`), endpoint de consulta protegido por rol.
- `CommonModule` — decorators de permisos/roles, filtro global de excepciones,
  interceptores.

## Modelo de datos (Prisma)

```prisma
model User {
  id                String   @id @default(uuid())
  email             String   @unique
  passwordHash      String
  name              String
  department        String?
  roleId            String
  role              Role     @relation(fields: [roleId], references: [id])
  mfaEnabled        Boolean  @default(false)
  isActive          Boolean  @default(true)
  lastLoginAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  mfaSettings       MfaSettings?
  refreshTokens     RefreshToken[]
}

model Role {
  id          String   @id @default(uuid())
  name        String   @unique // admin | editor | auditor | viewer
  description String?
  users       User[]
  permissions RolePermission[]
}

model Permission {
  id          String   @id @default(uuid())
  code        String   @unique
  description String?
  roles       RolePermission[]
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id])
  permission   Permission @relation(fields: [permissionId], references: [id])
  @@id([roleId, permissionId])
}

model MfaSettings {
  id               String    @id @default(uuid())
  userId           String    @unique
  user             User      @relation(fields: [userId], references: [id])
  secretEncrypted  String
  verifiedAt       DateTime?
  backupCodesHash  String[]
  createdAt        DateTime  @default(now())
}

model RefreshToken {
  id         String    @id @default(uuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  tokenHash  String
  expiresAt  DateTime
  revokedAt  DateTime?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime  @default(now())
}

model AuditLog {
  id         String   @id @default(uuid())
  timestamp  DateTime @default(now())
  userId     String?
  userEmail  String
  userRole   String
  action     String
  module     String   // Feeds | Publicaciones | Portales | Seguridad | Configuración | MFA
  entity     String?
  entityId   String?
  ipAddress  String?
  result     String   // Exitoso | Advertencia | Fallido
  details    Json?
}
```

Decisión: un usuario tiene **un solo rol** (`roleId` en `User`), sin tabla puente `user_roles`
M:N — coincide con `UserProfile.role: UserRole` del frontend Stitch y simplifica UI/auditoría.

## Flujo de autenticación

1. `POST /auth/login` — valida email + password (bcrypt). Si `mfaEnabled=false` (primer login),
   responde `{ requiresMfaSetup: true, setupToken }`. Si ya tiene MFA, responde
   `{ requiresMfaCode: true, challengeToken }`. Nunca se emite un JWT completo sin verificar MFA.
2. `POST /auth/mfa/setup` — con `setupToken`, genera secreto TOTP (librería `otplib`) + QR (data
   URL). Aún no se marca verificado.
3. `POST /auth/mfa/setup/verify` — valida el primer código TOTP, marca `mfaEnabled=true`,
   persiste `MfaSettings`, emite `access_token` (JWT, 15 min) + `refresh_token` (hasheado en BD,
   rotación, 7 días).
4. `POST /auth/mfa/verify` — logins subsecuentes; valida código TOTP contra `challengeToken`,
   emite tokens igual que el paso 3.
5. `POST /auth/refresh` — valida hash + expiración + no revocado del refresh token recibido, lo
   revoca y emite un par nuevo (rotación).
6. `POST /auth/logout` — revoca el refresh token actual.
7. Guards: `JwtAuthGuard` (valida access token), `RolesGuard` (decorator `@Roles(...)` por
   endpoint).
8. Toda acción sensible (login, MFA, cambios de usuario/rol, logout) se registra vía
   `AuditService`, persistida en `AuditLog`.

## Primer usuario administrador

Script `prisma db seed` que crea el rol `admin` (y los otros 3 roles base) y un usuario
administrador inicial leyendo `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` desde variables de
entorno. Documentado en el README del sub-proyecto 5.

## Manejo de errores

Filtro global `HttpExceptionFilter` devuelve `{ statusCode, message, error }` consistente.
Intentos de login fallidos y códigos MFA inválidos se auditan con `result: 'Fallido'` sin
filtrar si el email existe (mensaje genérico "credenciales inválidas").

## Testing

Jest + `@nestjs/testing`:
- Unitarias: `AuthService` (login, setup/verificación MFA, rotación de refresh token),
  `RolesGuard` (acceso permitido/denegado por rol).
- E2E: `/auth/login` → `/auth/mfa/verify` → acceso a un endpoint protegido con el JWT emitido.

## Fuera de alcance (se aborda en sub-proyectos posteriores)

- Feeds, publicaciones, portales WordPress y sus endpoints (sub-proyecto 2).
- Conexión del frontend React a esta API real (sub-proyecto 3).
- Plugin de WordPress (sub-proyecto 4).
- `docker-compose.yml` completo (servicios backend/frontend) y README final (sub-proyecto 5).
