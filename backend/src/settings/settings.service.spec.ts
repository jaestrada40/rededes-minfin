import { Test } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('SettingsService', () => {
  let service: SettingsService;
  const row = { id: 'default', institutionName: 'MINFIN', maintenanceMode: false };
  const prismaMock = {
    systemSettings: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({ ...row, maintenanceMode: true }),
    },
  };
  const auditMock = { log: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = moduleRef.get(SettingsService);
  });

  it('returns the single settings row', async () => {
    const settings = await service.get();
    expect(settings.id).toBe('default');
  });

  it('updates the settings row and audits the change', async () => {
    const settings = await service.update({ maintenanceMode: true }, { email: 'a@minfin.gob.gt' });
    expect(settings.maintenanceMode).toBe(true);
    expect(auditMock.log).toHaveBeenCalledWith(expect.objectContaining({ module: 'Configuración' }));
  });
});
