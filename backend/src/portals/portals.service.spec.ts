import { Test } from '@nestjs/testing';
import { PortalsService } from './portals.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('PortalsService', () => {
  let service: PortalsService;
  const prismaMock = {
    wordPressPortal: {
      findMany: jest.fn().mockResolvedValue([{ id: 'wp1' }, { id: 'wp2' }]),
      updateMany: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ id: 'wp1', connectionStatus: 'connected' }),
    },
    feedPortal: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
  };
  const auditMock = { log: jest.fn() };
  const actor = { email: 'a@minfin.gob.gt' };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PortalsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = moduleRef.get(PortalsService);
  });

  it('assigns a feed to the given portals, replacing prior assignments', async () => {
    await service.assignFeedToPortals('f1', ['wp1', 'wp2'], actor);
    expect(prismaMock.feedPortal.deleteMany).toHaveBeenCalledWith({ where: { feedId: 'f1' } });
    expect(prismaMock.feedPortal.createMany).toHaveBeenCalledWith({
      data: [
        { feedId: 'f1', portalId: 'wp1' },
        { feedId: 'f1', portalId: 'wp2' },
      ],
    });
  });

  it('assigns a feed to every portal in batchAssignFeedToAllPortals', async () => {
    await service.batchAssignFeedToAllPortals('f1', actor);
    expect(prismaMock.wordPressPortal.findMany).toHaveBeenCalled();
    expect(prismaMock.feedPortal.createMany).toHaveBeenCalledWith({
      data: [
        { feedId: 'f1', portalId: 'wp1' },
        { feedId: 'f1', portalId: 'wp2' },
      ],
    });
  });

  it('marks all portals connected after syncAll', async () => {
    await service.syncAll(actor);
    expect(prismaMock.wordPressPortal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ connectionStatus: 'connected' }) }),
    );
  });

  it('tests a single portal connection and returns true', async () => {
    const result = await service.testConnection('wp1', actor);
    expect(result).toBe(true);
    expect(prismaMock.wordPressPortal.update).toHaveBeenCalled();
  });
});
