import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';

describe('UsersService', () => {
  let service: UsersService;
  const prismaMock = {
    user: {
      create: jest.fn().mockResolvedValue({
        id: 'u1',
        email: 'a@minfin.gob.gt',
        roleId: 'r1',
      }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'a@minfin.gob.gt' }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'u1',
          email: 'super@minfin.gob.gt',
          name: 'Super',
          department: null,
          roleId: 'r1',
          isActive: true,
          mfaEnabled: true,
          lastLoginAt: new Date('2026-01-01'),
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          role: { name: 'super_admin' },
        },
      ]),
    },
  };
  const rolesMock = {
    findByName: jest.fn().mockResolvedValue({ id: 'r1', name: 'editor' }),
  };
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
    const user = await service.create(
      {
        email: 'a@minfin.gob.gt',
        password: 'Password123!',
        name: 'Ana',
        role: 'editor',
      },
      { id: 'actor1', email: 'admin@minfin.gob.gt', role: 'super_admin' },
    );
    expect(rolesMock.findByName).toHaveBeenCalledWith('editor');
    expect(prismaMock.user.create).toHaveBeenCalled();
    expect(user.email).toBe('a@minfin.gob.gt');
  });

  it('oculta mfaEnabled y lastLoginAt a un editor pero los conserva para admin/super_admin', async () => {
    const forEditor = await service.findAll({
      id: 'actor1',
      email: 'editor@minfin.gob.gt',
      role: 'editor',
    });
    expect(forEditor[0].mfaEnabled).toBeUndefined();
    expect(forEditor[0].lastLoginAt).toBeUndefined();
    expect(forEditor[0].email).toBe('super@minfin.gob.gt');

    const forAdmin = await service.findAll({
      id: 'actor2',
      email: 'admin@minfin.gob.gt',
      role: 'admin',
    });
    expect(forAdmin[0].mfaEnabled).toBe(true);
    expect(forAdmin[0].lastLoginAt).toEqual(new Date('2026-01-01'));
  });
});
