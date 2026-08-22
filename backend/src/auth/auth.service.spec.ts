import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { AttemptLimiterService } from './attempt-limiter.service';

describe('AuthService', () => {
  let service: AuthService;
  const passwordHash = bcrypt.hashSync('Password123!', 10);

  const userNoMfa = {
    id: 'u1',
    email: 'a@minfin.gob.gt',
    passwordHash,
    name: 'Ana',
    mfaEnabled: false,
    isActive: true,
    role: { name: 'editor' },
  };

  const usersMock = { findByEmail: jest.fn().mockResolvedValue(userNoMfa) };
  const auditMock = { log: jest.fn() };
  const settingsMock = { get: jest.fn().mockResolvedValue({ mfaRequired: true }) };
  const prismaMock = {
    mfaSettings: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),
      findUniqueOrThrow: jest.fn().mockResolvedValue(userNoMfa),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.MFA_ENCRYPTION_KEY = '0'.repeat(64);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UsersService, useValue: usersMock },
        { provide: AuditService, useValue: auditMock },
        { provide: SettingsService, useValue: settingsMock },
        // Instancia real: es un contador en memoria sin dependencias, y así
        // las pruebas ejercitan el límite de intentos de verdad.
        AttemptLimiterService,
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
    // El secreto pendiente vive en la base, no en el token: se captura lo que
    // mfaSetup guardó y se descifra igual que lo hace el servicio.
    let storedSecretEncrypted = '';
    prismaMock.mfaSettings.upsert = jest.fn().mockImplementation(({ create }: any) => {
      storedSecretEncrypted = create.secretEncrypted;
      return Promise.resolve({});
    });
    prismaMock.mfaSettings.findUnique = jest
      .fn()
      .mockImplementation(() => Promise.resolve(storedSecretEncrypted ? { secretEncrypted: storedSecretEncrypted, verifiedAt: null } : null));

    const { setupToken } = await service.login('a@minfin.gob.gt', 'Password123!');
    const { verifyToken, qrDataUrl } = await service.mfaSetup(setupToken!);
    expect(qrDataUrl).toContain('data:image');

    const code = authenticator.generate((service as any).decryptSecret(storedSecretEncrypted));

    const tokens = await service.mfaSetupVerify(verifyToken, code);
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
  });

  it('never puts the TOTP secret in the setup token payload', async () => {
    let storedSecretEncrypted = '';
    prismaMock.mfaSettings.upsert = jest.fn().mockImplementation(({ create }: any) => {
      storedSecretEncrypted = create.secretEncrypted;
      return Promise.resolve({});
    });
    prismaMock.mfaSettings.findUnique = jest.fn().mockResolvedValue(null);

    const login = (await service.login('a@minfin.gob.gt', 'Password123!')) as { setupToken: string };
    const { verifyToken } = await service.mfaSetup(login.setupToken);

    // Un JWT va firmado pero NO cifrado: quien intercepte el token puede leer
    // su payload en base64. El secreto tiene que quedar solo del lado del
    // servidor, cifrado.
    const payload = JSON.parse(Buffer.from(verifyToken.split('.')[1], 'base64').toString());
    expect(payload.secret).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain(storedSecretEncrypted);
  });

  it('locks the account after repeated failed logins instead of allowing unlimited guesses', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(service.login('a@minfin.gob.gt', 'wrong')).rejects.toThrow('Credenciales inválidas');
    }

    // El sexto intento ya no llega a comparar la contraseña: responde 429.
    await expect(service.login('a@minfin.gob.gt', 'wrong')).rejects.toMatchObject({
      status: 429,
    });
    // Incluso con la contraseña correcta, el bloqueo sigue vigente.
    await expect(service.login('a@minfin.gob.gt', 'Password123!')).rejects.toMatchObject({
      status: 429,
    });
  });

  it('locks MFA step-up verification after repeated invalid codes', async () => {
    prismaMock.mfaSettings.findUnique = jest.fn().mockResolvedValue({
      secretEncrypted: (service as any).encryptSecret(authenticator.generateSecret()),
      verifiedAt: new Date(),
    });

    for (let i = 0; i < 5; i++) {
      expect(await service.verifyMfaCode('u-stepup', '000000')).toBe(false);
    }

    await expect(service.verifyMfaCode('u-stepup', '000000')).rejects.toMatchObject({ status: 429 });
  });

  it('does not skip the bcrypt comparison when the email is unknown', async () => {
    usersMock.findByEmail.mockResolvedValueOnce(null);

    const start = process.hrtime.bigint();
    await expect(service.login('nadie@minfin.gob.gt', 'cualquiera')).rejects.toThrow('Credenciales inválidas');
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    // Un bcrypt con factor de costo 10 tarda decenas de milisegundos; la ruta
    // que omitía la comparación resolvía en menos de uno. Si este tiempo cae,
    // la comparación señuelo desapareció y el login vuelve a ser un oráculo
    // para enumerar qué correos tienen cuenta.
    expect(elapsedMs).toBeGreaterThan(10);
  });
});
