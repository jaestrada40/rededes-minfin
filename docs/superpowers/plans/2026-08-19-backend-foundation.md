# Base del Backend (NestJS + Prisma + Auth JWT/MFA + RBAC + Auditoría) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working NestJS + Prisma + PostgreSQL backend with institutional
authentication (email/password + JWT access token + rotating refresh token + mandatory TOTP
MFA), role-based access control, and persistent audit logging — mirroring the mock behavior
already implemented in `src/context/AppContext.tsx` of the existing Stitch frontend export.

**Architecture:** Monorepo split: existing React/Vite code moves to `/frontend` unchanged;
new NestJS project created in `/backend`. Backend modules: `PrismaModule` (global DB client),
`RolesModule`, `UsersModule`, `AuditModule`, `AuthModule` (login → MFA setup/verify → JWT +
refresh token rotation), `CommonModule` (guards, decorators, exception filter).

**Tech Stack:** NestJS 10, TypeScript, Prisma ORM, PostgreSQL, `@nestjs/jwt`, `@nestjs/passport`
+ `passport-jwt`, `bcrypt`, `otplib` (TOTP), `qrcode` (QR data URL), Jest + `@nestjs/testing` +
`supertest` for e2e.

**Spec:** `docs/superpowers/specs/2026-08-19-backend-foundation-design.md`

## Global Constraints

- Backend lives in `/backend`, frontend in `/frontend` (monorepo). — spec "Estructura de repositorio"
- MFA is mandatory from first login; no full JWT is ever issued without MFA verification. — spec "Flujo de autenticación"
- One role per user (`roleId` on `User`, no `user_roles` M:N table). — spec "Decisión"
- Refresh tokens are stored hashed in Postgres with rotation (old token revoked on use, new pair issued). — spec "Flujo de autenticación" step 5
- Roles seeded: `admin`, `editor`, `auditor`, `viewer` — matches frontend `UserRole` type exactly. — spec "Módulos NestJS" / RolesModule
- Login failures and invalid MFA codes must audit with `result: 'Fallido'` and never reveal whether an email exists. — spec "Manejo de errores"
- Every sensitive action (login, MFA, user/role changes, logout) is recorded via `AuditService` into `AuditLog`. — spec "Flujo de autenticación" step 8

---

## File Structure

```
/frontend/                      # moved as-is from repo root
/backend/
  prisma/
    schema.prisma
    seed.ts
  src/
    main.ts
    app.module.ts
    prisma/
      prisma.module.ts
      prisma.service.ts
    common/
      decorators/roles.decorator.ts
      guards/jwt-auth.guard.ts
      guards/roles.guard.ts
      filters/http-exception.filter.ts
      common.module.ts
    roles/
      roles.module.ts
      roles.service.ts
    users/
      dto/create-user.dto.ts
      users.module.ts
      users.service.ts
      users.controller.ts
    audit/
      audit.module.ts
      audit.service.ts
      audit.controller.ts
    auth/
      dto/login.dto.ts
      dto/mfa-verify.dto.ts
      strategies/jwt.strategy.ts
      auth.module.ts
      auth.service.ts
      auth.controller.ts
  test/
    auth.e2e-spec.ts
  package.json
  tsconfig.json
  nest-cli.json
  .env.example
docker-compose.yml              # postgres service only in this sub-project
```

---

### Task 1: Move frontend into `/frontend`

**Files:**
- Move: all current root files (`src/`, `index.html`, `package.json`, `vite.config.ts`,
  `tsconfig.json`, `assets/`, `metadata.json`, `.env.example`, `README.md`) into `/frontend/`.

**Interfaces:** none (pure relocation).

- [ ] **Step 1: Create `/frontend` and move existing files into it**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
mkdir frontend
git init  # only if not already a git repo — check first with `git status`
for f in src index.html package.json vite.config.ts tsconfig.json assets metadata.json .env.example README.md; do
  [ -e "$f" ] && mv "$f" frontend/
done
```

- [ ] **Step 2: Verify the frontend still builds from its new location**

Run: `cd frontend && npm install && npm run build`
Expected: build succeeds (Vite output in `frontend/dist`), no path errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
git add frontend
git commit -m "chore: move existing Stitch frontend export into /frontend"
```

---

### Task 2: Scaffold NestJS backend project

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/nest-cli.json`
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`
- Create: `backend/.env.example`

**Interfaces:**
- Produces: a running Nest app on `PORT` (default 4000) with global `ValidationPipe`, CORS
  enabled for the frontend origin.

- [ ] **Step 1: Generate the Nest project**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
npx -y @nestjs/cli new backend --package-manager npm --skip-git
```

- [ ] **Step 2: Install dependencies**

```bash
cd backend
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt otplib qrcode
npm install -D @types/passport-jwt @types/bcrypt @types/qrcode
npm install prisma @prisma/client
```

- [ ] **Step 3: Write `backend/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
```

- [ ] **Step 4: Write `backend/.env.example`**

```
DATABASE_URL="postgresql://minfin:minfin@localhost:5432/minfin_social?schema=public"
PORT=4000
CORS_ORIGIN="http://localhost:3000"
JWT_ACCESS_SECRET="change-me-access-secret"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN_DAYS=7
SEED_ADMIN_EMAIL="admin@minfin.gob.gt"
SEED_ADMIN_PASSWORD="ChangeMe123!"
```

- [ ] **Step 5: Verify the bare app boots**

Run: `cd backend && npm run build && node dist/main.js &` then `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000` (expect a response, e.g. 404, meaning the server is up), then stop the process.
Expected: server starts without throwing.

- [ ] **Step 6: Commit**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
git add backend
git commit -m "chore: scaffold NestJS backend project"
```

---

### Task 3: Prisma schema and initial migration

**Files:**
- Create: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma Client models `User`, `Role`, `Permission`, `RolePermission`,
  `MfaSettings`, `RefreshToken`, `AuditLog` — exact field names used by every later task.

- [ ] **Step 1: Write `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  name          String
  department    String?
  roleId        String
  role          Role      @relation(fields: [roleId], references: [id])
  mfaEnabled    Boolean   @default(false)
  isActive      Boolean   @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  mfaSettings   MfaSettings?
  refreshTokens RefreshToken[]
}

model Role {
  id          String           @id @default(uuid())
  name        String           @unique
  description String?
  users       User[]
  permissions RolePermission[]
}

model Permission {
  id          String           @id @default(uuid())
  code        String           @unique
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
  id              String    @id @default(uuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  secretEncrypted String
  verifiedAt      DateTime?
  backupCodesHash String[]
  createdAt       DateTime  @default(now())
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
  id        String   @id @default(uuid())
  timestamp DateTime @default(now())
  userId    String?
  userEmail String
  userRole  String
  action    String
  module    String
  entity    String?
  entityId  String?
  ipAddress String?
  result    String
  details   Json?
}
```

- [ ] **Step 2: Run initial migration against local Postgres**

Ensure a local Postgres is reachable at the `DATABASE_URL` in `backend/.env` (copy from
`.env.example` and start `docker run --rm -d --name minfin-pg -e POSTGRES_USER=minfin -e POSTGRES_PASSWORD=minfin -e POSTGRES_DB=minfin_social -p 5432:5432 postgres:16-alpine` if needed).

Run: `cd backend && cp .env.example .env && npx prisma migrate dev --name init`
Expected: migration folder created under `backend/prisma/migrations/`, Prisma Client generated,
no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
git add backend/prisma
git commit -m "feat: add Prisma schema and initial migration for auth/roles/audit"
```

---

### Task 4: PrismaModule + PrismaService

**Files:**
- Create: `backend/src/prisma/prisma.service.ts`
- Create: `backend/src/prisma/prisma.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `PrismaService` (extends `PrismaClient`, implements `OnModuleInit`/`OnModuleDestroy`),
  exported from a `@Global()` `PrismaModule`, injectable anywhere as `PrismaService`.

- [ ] **Step 1: Write `backend/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Write `backend/src/prisma/prisma.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Register `PrismaModule` in `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
})
export class AppModule {}
```

- [ ] **Step 4: Verify build**

Run: `cd backend && npm run build`
Expected: compiles with no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
git add backend/src/prisma backend/src/app.module.ts
git commit -m "feat: add global PrismaModule"
```

---

### Task 5: RolesModule + seed script (roles, permissions, first admin user)

**Files:**
- Create: `backend/src/roles/roles.service.ts`
- Create: `backend/src/roles/roles.module.ts`
- Create: `backend/prisma/seed.ts`
- Modify: `backend/package.json` (add `prisma.seed` config)
- Test: `backend/src/roles/roles.service.spec.ts`

**Interfaces:**
- Produces: `RolesService.findByName(name: string): Promise<Role | null>`,
  `RolesService.findAll(): Promise<Role[]>` — consumed by `AuthService` (Task 9) and
  `UsersModule` (Task 6).

- [ ] **Step 1: Write the failing test `backend/src/roles/roles.service.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RolesService', () => {
  let service: RolesService;
  const prismaMock = {
    role: {
      findUnique: jest.fn().mockResolvedValue({ id: 'r1', name: 'admin', description: null }),
      findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'admin', description: null }]),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RolesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(RolesService);
  });

  it('finds a role by name', async () => {
    const role = await service.findByName('admin');
    expect(role?.name).toBe('admin');
  });

  it('lists all roles', async () => {
    const roles = await service.findAll();
    expect(roles).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/roles/roles.service.spec.ts`
Expected: FAIL — `Cannot find module './roles.service'`.

- [ ] **Step 3: Write `backend/src/roles/roles.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findByName(name: string): Promise<Role | null> {
    return this.prisma.role.findUnique({ where: { name } });
  }

  findAll(): Promise<Role[]> {
    return this.prisma.role.findMany();
  }
}
```

- [ ] **Step 4: Write `backend/src/roles/roles.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';

@Module({
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/roles/roles.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write `backend/prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ROLE_NAMES = ['admin', 'editor', 'auditor', 'viewer'] as const;

async function main() {
  for (const name of ROLE_NAMES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@minfin.gob.gt';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: 'Administrador DTI',
      roleId: adminRole.id,
      mfaEnabled: false,
    },
  });

  console.log(`Seed completo. Usuario admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 7: Register the seed command in `backend/package.json`**

Add to `backend/package.json` top level:

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

Run: `cd backend && npm install -D ts-node`

- [ ] **Step 8: Run the seed and verify the admin user exists**

Run: `cd backend && npx prisma db seed`
Expected: prints `Seed completo. Usuario admin: admin@minfin.gob.gt`; verify with
`npx prisma studio` or `psql` that `role` has 4 rows and `user` has 1 row with `mfa_enabled=false`.

- [ ] **Step 9: Commit**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
git add backend/src/roles backend/prisma/seed.ts backend/package.json
git commit -m "feat: add RolesModule and Prisma seed for base roles and admin user"
```

---

### Task 6: UsersModule (CRUD + role assignment)

**Files:**
- Create: `backend/src/users/dto/create-user.dto.ts`
- Create: `backend/src/users/users.service.ts`
- Create: `backend/src/users/users.controller.ts`
- Create: `backend/src/users/users.module.ts`
- Test: `backend/src/users/users.service.spec.ts`

**Interfaces:**
- Consumes: `RolesService.findByName` (Task 5), `PrismaService` (Task 4), `AuditService.log`
  (Task 7 — injected here; `UsersModule` imports `AuditModule`).
- Produces: `UsersService.create(dto: CreateUserDto): Promise<User>`,
  `UsersService.findByEmail(email: string): Promise<User | null>`,
  `UsersService.findAll(): Promise<User[]>`,
  `UsersService.updateRole(userId: string, roleName: string, actor: { id: string; email: string; role: string }): Promise<User>` —
  consumed by `AuthService` (Task 9, via `findByEmail`).

- [ ] **Step 1: Write `backend/src/users/dto/create-user.dto.ts`**

```typescript
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsIn(['admin', 'editor', 'auditor', 'viewer'])
  role: string;

  department?: string;
}
```

- [ ] **Step 2: Write the failing test `backend/src/users/users.service.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';

describe('UsersService', () => {
  let service: UsersService;
  const prismaMock = {
    user: {
      create: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@minfin.gob.gt', roleId: 'r1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@minfin.gob.gt' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const rolesMock = { findByName: jest.fn().mockResolvedValue({ id: 'r1', name: 'editor' }) };
  const auditMock = { log: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RolesService, useValue: rolesMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('creates a user with a hashed password and resolved role', async () => {
    const user = await service.create({
      email: 'a@minfin.gob.gt',
      password: 'Password123!',
      name: 'Ana',
      role: 'editor',
    });
    expect(rolesMock.findByName).toHaveBeenCalledWith('editor');
    expect(prismaMock.user.create).toHaveBeenCalled();
    expect(user.email).toBe('a@minfin.gob.gt');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest src/users/users.service.spec.ts`
Expected: FAIL — `Cannot find module './users.service'`.

- [ ] **Step 4: Write `backend/src/users/users.service.ts`**

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const role = await this.roles.findByName(dto.role);
    if (!role) throw new BadRequestException(`Rol inválido: ${dto.role}`);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        department: dto.department,
        roleId: role.id,
      },
    });

    await this.audit.log({
      userEmail: user.email,
      userRole: role.name,
      action: 'Creó usuario institucional',
      module: 'Configuración',
      entity: 'User',
      entityId: user.id,
      result: 'Exitoso',
    });

    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async updateRole(
    userId: string,
    roleName: string,
    actor: { id: string; email: string; role: string },
  ): Promise<User> {
    const role = await this.roles.findByName(roleName);
    if (!role) throw new BadRequestException(`Rol inválido: ${roleName}`);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: role.id },
    });

    await this.audit.log({
      userId: actor.id,
      userEmail: actor.email,
      userRole: actor.role,
      action: 'Cambió el rol de un usuario',
      module: 'Configuración',
      entity: 'User',
      entityId: userId,
      details: { newRole: roleName },
      result: 'Exitoso',
    });

    return user;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/users/users.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Write `backend/src/users/users.controller.ts`**

```typescript
import { Body, Controller, Get, Param, Patch, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Roles('admin', 'editor', 'auditor', 'viewer')
  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Roles('admin')
  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body('role') role: string, @Req() req: any) {
    return this.users.updateRole(id, role, req.user);
  }
}
```

- [ ] **Step 7: Write `backend/src/users/users.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesModule } from '../roles/roles.module';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [RolesModule, AuditModule, CommonModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 8: Commit**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
git add backend/src/users
git commit -m "feat: add UsersModule with role-guarded CRUD"
```

---

### Task 7: AuditModule

**Files:**
- Create: `backend/src/audit/audit.service.ts`
- Create: `backend/src/audit/audit.controller.ts`
- Create: `backend/src/audit/audit.module.ts`
- Test: `backend/src/audit/audit.service.spec.ts`

**Interfaces:**
- Produces: `AuditService.log(entry: { userId?: string; userEmail: string; userRole: string; action: string; module: string; entity?: string; entityId?: string; ipAddress?: string; result: 'Exitoso' | 'Advertencia' | 'Fallido'; details?: Record<string, unknown> }): Promise<void>` —
  consumed by `UsersModule` (Task 6) and `AuthModule` (Task 9).

- [ ] **Step 1: Write the failing test `backend/src/audit/audit.service.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  const prismaMock = { auditLog: { create: jest.fn().mockResolvedValue({}) } };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  it('persists an audit entry with the given result', async () => {
    await service.log({
      userEmail: 'a@minfin.gob.gt',
      userRole: 'admin',
      action: 'Inicio de sesión',
      module: 'Seguridad',
      result: 'Exitoso',
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'Inicio de sesión', result: 'Exitoso' }),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/audit/audit.service.spec.ts`
Expected: FAIL — `Cannot find module './audit.service'`.

- [ ] **Step 3: Write `backend/src/audit/audit.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  userId?: string;
  userEmail: string;
  userRole: string;
  action: string;
  module: string;
  entity?: string;
  entityId?: string;
  ipAddress?: string;
  result: 'Exitoso' | 'Advertencia' | 'Fallido';
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        userEmail: entry.userEmail,
        userRole: entry.userRole,
        action: entry.action,
        module: entry.module,
        entity: entry.entity,
        entityId: entry.entityId,
        ipAddress: entry.ipAddress,
        result: entry.result,
        details: entry.details as any,
      },
    });
  }

  findAll() {
    return this.prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' } });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/audit/audit.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write `backend/src/audit/audit.controller.ts`**

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Roles('admin', 'auditor')
  @Get()
  findAll() {
    return this.audit.findAll();
  }
}
```

- [ ] **Step 6: Write `backend/src/audit/audit.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
```

- [ ] **Step 7: Commit**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
git add backend/src/audit
git commit -m "feat: add AuditModule with persistent audit logging"
```

---

### Task 8: Common module — guards, decorator, exception filter

**Files:**
- Create: `backend/src/common/decorators/roles.decorator.ts`
- Create: `backend/src/common/guards/jwt-auth.guard.ts`
- Create: `backend/src/common/guards/roles.guard.ts`
- Create: `backend/src/common/filters/http-exception.filter.ts`
- Create: `backend/src/common/common.module.ts`
- Test: `backend/src/common/guards/roles.guard.spec.ts`

**Interfaces:**
- Produces: `@Roles(...roles: string[])` decorator, `JwtAuthGuard`, `RolesGuard`,
  `HttpExceptionFilter` — consumed by every controller (Tasks 6, 7, 9).
- Consumes: nothing from prior tasks (pure Nest primitives); `JwtAuthGuard` relies on the
  `JwtStrategy` registered by `AuthModule` (Task 9) via Passport's global strategy name `'jwt'`.

- [ ] **Step 1: Write `backend/src/common/decorators/roles.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 2: Write the failing test `backend/src/common/guards/roles.guard.spec.ts`**

```typescript
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function contextWith(role: string | undefined, requiredRoles: string[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    getHandler: () => {},
    getClass: () => {},
  } as unknown as ExecutionContext;
  return { guard, context };
}

describe('RolesGuard', () => {
  it('allows access when the user has one of the required roles', () => {
    const { guard, context } = contextWith('admin', ['admin', 'editor']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when the user role is not included', () => {
    const { guard, context } = contextWith('viewer', ['admin', 'editor']);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows access when no roles are required', () => {
    const { guard, context } = contextWith('viewer', undefined);
    expect(guard.canActivate(context)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest src/common/guards/roles.guard.spec.ts`
Expected: FAIL — `Cannot find module './roles.guard'`.

- [ ] **Step 4: Write `backend/src/common/guards/roles.guard.ts`**

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    return !!user && requiredRoles.includes(user.role);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/common/guards/roles.guard.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write `backend/src/common/guards/jwt-auth.guard.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 7: Write `backend/src/common/filters/http-exception.filter.ts`**

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Error interno del servidor';

    response.status(status).json({
      statusCode: status,
      error: exception instanceof HttpException ? exception.name : 'InternalServerError',
      message: typeof message === 'string' ? message : (message as any).message ?? message,
    });
  }
}
```

- [ ] **Step 8: Write `backend/src/common/common.module.ts`**

```typescript
import { Module } from '@nestjs/common';

@Module({})
export class CommonModule {}
```

- [ ] **Step 9: Register the global exception filter in `backend/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
```

- [ ] **Step 10: Commit**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
git add backend/src/common backend/src/main.ts
git commit -m "feat: add RolesGuard, JwtAuthGuard, exception filter"
```

---

### Task 9: AuthModule — login, MFA setup/verify, refresh rotation, logout

**Files:**
- Create: `backend/src/auth/dto/login.dto.ts`
- Create: `backend/src/auth/dto/mfa-verify.dto.ts`
- Create: `backend/src/auth/strategies/jwt.strategy.ts`
- Create: `backend/src/auth/auth.service.ts`
- Create: `backend/src/auth/auth.controller.ts`
- Create: `backend/src/auth/auth.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `UsersService.findByEmail` (Task 6), `AuditService.log` (Task 7).
- Produces: `AuthService.login(email, password): Promise<{ requiresMfaSetup?: true; requiresMfaCode?: true; setupToken?: string; challengeToken?: string }>`,
  `AuthService.mfaSetup(setupToken: string): Promise<{ qrDataUrl: string; verifyToken: string }>`,
  `AuthService.mfaSetupVerify(verifyToken: string, code: string, ip?: string): Promise<{ accessToken: string; refreshToken: string }>`,
  `AuthService.mfaVerify(challengeToken: string, code: string, ip?: string): Promise<{ accessToken: string; refreshToken: string }>`,
  `AuthService.refresh(refreshToken: string, ip?: string): Promise<{ accessToken: string; refreshToken: string }>`,
  `AuthService.logout(refreshToken: string): Promise<void>`.

- [ ] **Step 1: Write `backend/src/auth/dto/login.dto.ts`**

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
```

- [ ] **Step 2: Write `backend/src/auth/dto/mfa-verify.dto.ts`**

```typescript
import { IsString, Length } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  token: string;

  @IsString()
  @Length(6, 6)
  code: string;
}
```

- [ ] **Step 3: Write the failing test `backend/src/auth/auth.service.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';

describe('AuthService', () => {
  let service: AuthService;
  const passwordHash = bcrypt.hashSync('Password123!', 10);

  const userNoMfa = {
    id: 'u1',
    email: 'a@minfin.gob.gt',
    passwordHash,
    name: 'Ana',
    mfaEnabled: false,
    role: { name: 'editor' },
  };

  const usersMock = { findByEmail: jest.fn().mockResolvedValue(userNoMfa) };
  const auditMock = { log: jest.fn() };
  const prismaMock = {
    mfaSettings: { create: jest.fn().mockResolvedValue({}), update: jest.fn() },
    user: { update: jest.fn().mockResolvedValue({}) },
    refreshToken: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UsersService, useValue: usersMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('requires MFA setup on first login', async () => {
    const result = await service.login('a@minfin.gob.gt', 'Password123!');
    expect(result.requiresMfaSetup).toBe(true);
    expect(result.setupToken).toBeDefined();
  });

  it('rejects an invalid password without revealing account existence', async () => {
    await expect(service.login('a@minfin.gob.gt', 'wrong')).rejects.toThrow();
    expect(auditMock.log).toHaveBeenCalledWith(expect.objectContaining({ result: 'Fallido' }));
  });

  it('issues tokens after completing MFA setup with a valid TOTP code', async () => {
    const { setupToken } = await service.login('a@minfin.gob.gt', 'Password123!');
    const { verifyToken, qrDataUrl } = await service.mfaSetup(setupToken!);
    expect(qrDataUrl).toContain('data:image');

    const secret = (service as any).decodeSetupSecret(verifyToken);
    const code = authenticator.generate(secret);

    const tokens = await service.mfaSetupVerify(verifyToken, code);
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && npx jest src/auth/auth.service.spec.ts`
Expected: FAIL — `Cannot find module './auth.service'`.

- [ ] **Step 5: Write `backend/src/auth/auth.service.ts`**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private signInternal(payload: Record<string, unknown>): string {
    return this.jwt.sign(payload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' });
  }

  decodeSetupSecret(token: string): string {
    const payload = this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET }) as { secret: string };
    return payload.secret;
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !valid) {
      await this.audit.log({
        userEmail: email,
        userRole: 'desconocido',
        action: 'Intento de inicio de sesión',
        module: 'Seguridad',
        result: 'Fallido',
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.mfaEnabled) {
      const setupToken = this.signInternal({ purpose: 'mfa-setup', userId: user.id });
      return { requiresMfaSetup: true as const, setupToken };
    }

    const challengeToken = this.signInternal({ purpose: 'mfa-challenge', userId: user.id });
    return { requiresMfaCode: true as const, challengeToken };
  }

  async mfaSetup(setupToken: string) {
    const payload = this.jwt.verify(setupToken, { secret: process.env.JWT_ACCESS_SECRET }) as {
      purpose: string;
      userId: string;
    };
    if (payload.purpose !== 'mfa-setup') throw new UnauthorizedException('Token inválido');

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri('usuario', 'MINFIN Gestor Social', secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    const verifyToken = this.jwt.sign(
      { purpose: 'mfa-setup-verify', userId: payload.userId, secret },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m' },
    );

    return { qrDataUrl, verifyToken };
  }

  async mfaSetupVerify(verifyToken: string, code: string, ip?: string): Promise<TokenPair> {
    const payload = this.jwt.verify(verifyToken, { secret: process.env.JWT_ACCESS_SECRET }) as {
      purpose: string;
      userId: string;
      secret: string;
    };
    if (payload.purpose !== 'mfa-setup-verify') throw new UnauthorizedException('Token inválido');

    const validCode = authenticator.check(code, payload.secret);
    if (!validCode) {
      await this.audit.log({
        userId: payload.userId,
        userEmail: 'desconocido',
        userRole: 'desconocido',
        action: 'Código MFA inválido durante configuración',
        module: 'MFA',
        result: 'Fallido',
        ipAddress: ip,
      });
      throw new UnauthorizedException('Código MFA inválido');
    }

    await this.prisma.mfaSettings.create({
      data: { userId: payload.userId, secretEncrypted: payload.secret, verifiedAt: new Date() },
    });
    await this.prisma.user.update({ where: { id: payload.userId }, data: { mfaEnabled: true, lastLoginAt: new Date() } });

    return this.issueTokens(payload.userId, ip);
  }

  async mfaVerify(challengeToken: string, code: string, ip?: string): Promise<TokenPair> {
    const payload = this.jwt.verify(challengeToken, { secret: process.env.JWT_ACCESS_SECRET }) as {
      purpose: string;
      userId: string;
    };
    if (payload.purpose !== 'mfa-challenge') throw new UnauthorizedException('Token inválido');

    const settings = await this.prisma.mfaSettings.findUnique({ where: { userId: payload.userId } });
    const validCode = settings ? authenticator.check(code, settings.secretEncrypted) : false;

    if (!validCode) {
      await this.audit.log({
        userId: payload.userId,
        userEmail: 'desconocido',
        userRole: 'desconocido',
        action: 'Código MFA inválido en inicio de sesión',
        module: 'MFA',
        result: 'Fallido',
        ipAddress: ip,
      });
      throw new UnauthorizedException('Código MFA inválido');
    }

    await this.prisma.user.update({ where: { id: payload.userId }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(payload.userId, ip);
  }

  private async issueTokens(userId: string, ip?: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true } });

    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role.name },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m' },
    );

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const days = Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt, ipAddress: ip },
    });

    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role.name,
      action: 'Inicio de sesión institucional exitoso',
      module: 'MFA',
      result: 'Exitoso',
      ipAddress: ip,
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  async refresh(refreshToken: string, ip?: string): Promise<TokenPair> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!stored) throw new UnauthorizedException('Refresh token inválido o expirado');

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.userId, ip);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npx jest src/auth/auth.service.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Write `backend/src/auth/strategies/jwt.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET,
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
```

- [ ] **Step 8: Write `backend/src/auth/auth.controller.ts`**

```typescript
import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('mfa/setup')
  mfaSetup(@Body('setupToken') setupToken: string) {
    return this.auth.mfaSetup(setupToken);
  }

  @Post('mfa/setup/verify')
  mfaSetupVerify(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    return this.auth.mfaSetupVerify(dto.token, dto.code, req.ip);
  }

  @Post('mfa/verify')
  mfaVerify(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    return this.auth.mfaVerify(dto.token, dto.code, req.ip);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string, @Req() req: Request) {
    return this.auth.refresh(refreshToken, req.ip);
  }

  @Post('logout')
  logout(@Body('refreshToken') refreshToken: string) {
    return this.auth.logout(refreshToken);
  }
}
```

- [ ] **Step 9: Write `backend/src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), UsersModule, AuditModule],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 10: Register `AuthModule`, `RolesModule`, `UsersModule`, `AuditModule` in `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, RolesModule, UsersModule, AuditModule, AuthModule],
})
export class AppModule {}
```

- [ ] **Step 11: Full test suite + build check**

Run: `cd backend && npx jest && npm run build`
Expected: all unit tests pass, build succeeds.

- [ ] **Step 12: Commit**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
git add backend/src/auth backend/src/app.module.ts
git commit -m "feat: add AuthModule with login, TOTP MFA, refresh rotation, logout"
```

---

### Task 10: E2E test — full login → MFA setup → protected endpoint flow

**Files:**
- Create: `backend/test/auth.e2e-spec.ts`
- Modify: `backend/package.json` (ensure `test:e2e` script points at `test/jest-e2e.json`, generated by Nest CLI scaffold in Task 2 — verify it exists, create if missing)

**Interfaces:**
- Consumes: the full running `AppModule` (all modules from Tasks 4–9) against a real test
  database.

- [ ] **Step 1: Ensure a dedicated test database exists**

Run: `docker run --rm -d --name minfin-pg-test -e POSTGRES_USER=minfin -e POSTGRES_PASSWORD=minfin -e POSTGRES_DB=minfin_social_test -p 5433:5432 postgres:16-alpine`

Run: `cd backend && DATABASE_URL="postgresql://minfin:minfin@localhost:5433/minfin_social_test?schema=public" npx prisma migrate deploy`
Expected: migrations applied to the test database with no errors.

- [ ] **Step 2: Write `backend/test/auth.e2e-spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { authenticator } from 'otplib';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = 'e2e-admin@minfin.gob.gt';
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const role = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: { name: 'admin' },
    });
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: 'E2E Admin', passwordHash: await bcrypt.hash(password, 10), roleId: role.id },
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.mfaSettings.deleteMany({});
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('completes login -> MFA setup -> access to a protected endpoint', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    expect(loginRes.body.requiresMfaSetup).toBe(true);

    const setupRes = await request(app.getHttpServer())
      .post('/auth/mfa/setup')
      .send({ setupToken: loginRes.body.setupToken })
      .expect(201);
    expect(setupRes.body.qrDataUrl).toContain('data:image');

    const secret = Buffer.from(setupRes.body.verifyToken.split('.')[1], 'base64').toString();
    const decodedSecret = JSON.parse(secret).secret;
    const code = authenticator.generate(decodedSecret);

    const verifyRes = await request(app.getHttpServer())
      .post('/auth/mfa/setup/verify')
      .send({ token: setupRes.body.verifyToken, code })
      .expect(201);
    expect(verifyRes.body.accessToken).toBeDefined();

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${verifyRes.body.accessToken}`)
      .expect(200);
  });

  it('rejects access to a protected endpoint without a token', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });
});
```

- [ ] **Step 3: Run the e2e test**

Run: `cd backend && DATABASE_URL="postgresql://minfin:minfin@localhost:5433/minfin_social_test?schema=public" JWT_ACCESS_SECRET=test-secret npx jest --config ./test/jest-e2e.json`
Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
git add backend/test
git commit -m "test: add e2e coverage for login -> MFA setup -> protected endpoint"
```

---

### Task 11: docker-compose Postgres service + root env example

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example` (root, referencing `DATABASE_URL` shape used by `backend/.env.example`)

**Interfaces:** none (infra only; backend/frontend services added in sub-project 5).

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: minfin
      POSTGRES_PASSWORD: minfin
      POSTGRES_DB: minfin_social
    ports:
      - "5432:5432"
    volumes:
      - minfin_pg_data:/var/lib/postgresql/data

volumes:
  minfin_pg_data:
```

- [ ] **Step 2: Write root `.env.example`**

```
# Ver backend/.env.example y frontend/.env.example para variables específicas de cada servicio.
DATABASE_URL="postgresql://minfin:minfin@localhost:5432/minfin_social?schema=public"
```

- [ ] **Step 3: Verify Postgres starts via compose and the backend can migrate against it**

Run: `docker compose up -d postgres`
Run: `cd backend && npx prisma migrate deploy`
Expected: container healthy, migrations apply without error.

- [ ] **Step 4: Commit**

```bash
cd /Users/javierestrada/Documents/Proyecto/gestor-centralizado-de-redes-sociales---minfin
git add docker-compose.yml .env.example
git commit -m "chore: add docker-compose Postgres service for local development"
```

---

## Self-Review Notes

- **Spec coverage:** module structure (Task 5–9), Prisma schema exactly as specified (Task 3),
  single-role-per-user decision honored (Task 3, 6), full auth flow steps 1–8 (Task 9), seed
  script (Task 5), error handling / generic invalid-credentials message (Task 9 `login`), audit
  logging on every sensitive action (Tasks 6, 7, 9), unit + e2e testing (Tasks 5–10) — all
  covered.
- **Type consistency:** `AuditService.log` signature defined in Task 7 matches every call site in
  Tasks 6 and 9. `RolesService.findByName`/`findAll` signatures from Task 5 match usage in Tasks
  6 and 9. `UsersService.findByEmail` used in Task 9 matches Task 6's definition.
- **Out of scope reminder:** feeds/posts/portals endpoints, frontend API wiring, WordPress
  plugin, and the full docker-compose (backend/frontend services) are explicitly deferred to
  sub-projects 2–5 per the spec.
