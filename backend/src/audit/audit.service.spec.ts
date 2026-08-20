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
