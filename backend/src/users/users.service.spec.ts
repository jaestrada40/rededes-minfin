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
