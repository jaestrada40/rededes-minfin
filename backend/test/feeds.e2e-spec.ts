import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
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
