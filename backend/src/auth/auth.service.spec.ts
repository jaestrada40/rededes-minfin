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
    isActive: true,
    role: { name: 'editor' },
  };

  const usersMock = { findByEmail: jest.fn().mockResolvedValue(userNoMfa) };
  const auditMock = { log: jest.fn() };
  const prismaMock = {
    mfaSettings: { create: jest.fn().mockResolvedValue({}), update: jest.fn() },
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
