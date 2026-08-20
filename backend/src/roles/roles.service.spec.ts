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
