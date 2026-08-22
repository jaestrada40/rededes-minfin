import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Feeds and portals flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const email = 'e2e-feeds-admin@minfin.gob.gt';
  const password = 'Password123!';
  const editorEmail = 'e2e-feeds-editor@minfin.gob.gt';
  let accessToken: string;
  let editorAccessToken: string;
  let adminSecret: string;
  let portalId: string;
  // Nombre único por corrida: el slug se deriva del nombre y tiene índice
  // único, así que un nombre fijo choca contra el feed de la corrida anterior.
  const feedName = `Feed E2E ${Date.now()}`;
  let createdFeedId: string | undefined;

  /**
   * Completa el alta de un usuario: login, configuración de MFA y verificación.
   * El secreto TOTP ya no viaja en el token —queda cifrado del lado del
   * servidor—, así que se lee del registro pendiente y se descifra.
   */
  async function enrollAndLogin(
    userEmail: string,
  ): Promise<{ accessToken: string; secret: string }> {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userEmail, password });
    const setupRes = await request(app.getHttpServer())
      .post('/auth/mfa/setup')
      .send({ setupToken: loginRes.body.setupToken });

    const { userId } = JSON.parse(
      Buffer.from(setupRes.body.verifyToken.split('.')[1], 'base64').toString(),
    );
    const pending = await prisma.mfaSettings.findUniqueOrThrow({
      where: { userId },
    });
    const secret = (auth as any).decryptSecret(pending.secretEncrypted);

    const verifyRes = await request(app.getHttpServer())
      .post('/auth/mfa/setup/verify')
      .send({
        token: setupRes.body.verifyToken,
        code: authenticator.generate(secret),
      });

    return { accessToken: verifyRes.body.accessToken, secret };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);
    auth = moduleRef.get(AuthService);

    const role = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: { name: 'admin' },
    });
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: 'E2E Feeds Admin',
        passwordHash: await bcrypt.hash(password, 10),
        roleId: role.id,
      },
    });
    await prisma.systemSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        webhookSecret: 'test-secret',
        allowedCorsDomains: [],
        officialAccounts: {},
      },
    });
    const portal = await prisma.wordPressPortal.create({
      data: {
        name: 'Portal E2E',
        domain: `e2e-${Date.now()}.minfin.gob.gt`,
        category: 'Institucional',
        description: 'Portal de prueba e2e',
      },
    });
    portalId = portal.id;

    const adminSession = await enrollAndLogin(email);
    accessToken = adminSession.accessToken;
    adminSecret = adminSession.secret;

    // "editor" es el rol de menor privilegio tras la reestructura: puede
    // gestionar contenido, pero no la configuración del sistema ni los
    // portales WordPress (eso quedó reservado a super_admin).
    const editorRole = await prisma.role.upsert({
      where: { name: 'editor' },
      update: {},
      create: { name: 'editor' },
    });
    await prisma.user.upsert({
      where: { email: editorEmail },
      update: {},
      create: {
        email: editorEmail,
        name: 'E2E Feeds Editor',
        passwordHash: await bcrypt.hash(password, 10),
        roleId: editorRole.id,
      },
    });
    editorAccessToken = (await enrollAndLogin(editorEmail)).accessToken;
  });

  afterAll(async () => {
    if (createdFeedId) {
      await prisma.feedPost.deleteMany({ where: { feedId: createdFeedId } });
      await prisma.feedPortal.deleteMany({ where: { feedId: createdFeedId } });
      await prisma.feed.deleteMany({ where: { id: createdFeedId } });
    }
    await prisma.wordPressPortal.deleteMany({ where: { id: portalId } });
    // Igual que en auth.e2e: se limpia solo lo propio, porque las suites
    // comparten base de datos y Jest las corre en paralelo.
    const users = await prisma.user.findMany({
      where: { email: { in: [email, editorEmail] } },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.mfaSettings.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app.close();
  });

  it('creates a feed, adds a post, assigns a portal, and returns them in order', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/feeds')
      .set('Authorization', `Bearer ${accessToken}`)
      // Crear un feed y agregar publicaciones son acciones sensibles: con MFA
      // configurado exigen re-confirmar con el código TOTP actual.
      .send({
        name: feedName,
        description: 'desc',
        network: 'x',
        mfaCode: authenticator.generate(adminSecret),
      })
      .expect(201);
    const feedId = createRes.body.id;
    createdFeedId = feedId;

    await request(app.getHttpServer())
      .post(`/feeds/${feedId}/posts`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        urlOrId: 'https://x.com/MinfinGT/status/9988776655',
        network: 'x',
        mfaCode: authenticator.generate(adminSecret),
      })
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

  it('denies the editor role on super_admin-only endpoints', async () => {
    // La configuración institucional y los portales WordPress son
    // configuración técnica: solo super_admin (DTI).
    await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', `Bearer ${editorAccessToken}`)
      .send({ institutionName: 'Hacked' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/portals/sync-all')
      .set('Authorization', `Bearer ${editorAccessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/portals')
      .set('Authorization', `Bearer ${editorAccessToken}`)
      .send({
        name: 'Portal Denegado',
        domain: 'no.minfin.gob.gt',
        category: 'Institucional',
        description: 'x',
      })
      .expect(403);

    // La bitácora de auditoría también quedó reservada a super_admin.
    await request(app.getHttpServer())
      .get('/audit')
      .set('Authorization', `Bearer ${editorAccessToken}`)
      .expect(403);
  });

  it('maps a duplicate slug to 409 instead of a 500, through the global filter', async () => {
    // El filtro se registra vía APP_FILTER en CommonModule; si volviera a
    // registrarse solo en main.ts, este caso respondería 500 en pruebas.
    await request(app.getHttpServer())
      .post('/feeds')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: feedName,
        description: 'duplicado',
        network: 'x',
        mfaCode: authenticator.generate(adminSecret),
      })
      .expect(409);
  });

  it('denies the editor role on the admin-only permanent delete', async () => {
    // Quitar una publicación de un feed lo puede hacer un editor, pero
    // borrarla de la base de datos es de admin/super_admin.
    await request(app.getHttpServer())
      .delete('/posts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${editorAccessToken}`)
      .send({})
      .expect(403);
  });
});
