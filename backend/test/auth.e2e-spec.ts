import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { authenticator } from 'otplib';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import * as bcrypt from 'bcrypt';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const email = 'e2e-admin@minfin.gob.gt';
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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

    // El secreto TOTP ya no viaja en el token: queda cifrado del lado del
    // servidor. Un cliente legítimo lo obtiene escaneando el QR; aquí se lee
    // del registro pendiente y se descifra con el mismo servicio.
    const payload = JSON.parse(Buffer.from(setupRes.body.verifyToken.split('.')[1], 'base64').toString());
    expect(payload.secret).toBeUndefined();

    const pending = await prisma.mfaSettings.findUniqueOrThrow({ where: { userId: payload.userId } });
    const decodedSecret = (auth as any).decryptSecret(pending.secretEncrypted);
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
