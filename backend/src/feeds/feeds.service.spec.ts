import { Test } from '@nestjs/testing';
import { FeedsService } from './feeds.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('FeedsService', () => {
  let service: FeedsService;
  const feedRow = {
    id: 'f1',
    slug: 'x-comunicados',
    name: 'X – Comunicados',
    description: 'desc',
    network: 'x',
    status: 'active',
    layoutDefault: 'grid',
    maxItemsDefault: 6,
    showMetrics: true,
    showMedia: true,
    autoRefreshMinutes: 5,
    updatedBy: 'a@minfin.gob.gt',
  };
  const prismaMock = {
    feed: {
      create: jest.fn().mockResolvedValue(feedRow),
      findMany: jest.fn().mockResolvedValue([feedRow]),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...feedRow, posts: [], portals: [] }),
      update: jest.fn().mockResolvedValue(feedRow),
      delete: jest.fn().mockResolvedValue(feedRow),
    },
    feedPost: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn() },
  };
  const auditMock = { log: jest.fn() };
  const actor = { email: 'a@minfin.gob.gt' };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeedsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = moduleRef.get(FeedsService);
  });

  it('creates a feed and derives a slug from the name when none is given', async () => {
    const feed = await service.create(
      { name: 'X – Comunicados', description: 'desc', network: 'x' },
      actor,
    );
    expect(prismaMock.feed.create).toHaveBeenCalled();
    expect(feed.slug).toBe('x-comunicados');
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'Feeds', result: 'Exitoso' }),
    );
  });

  it('duplicates a feed with a new slug', async () => {
    const feed = await service.duplicate('f1', actor);
    expect(feed).toBeDefined();
    expect(prismaMock.feed.create).toHaveBeenCalled();
  });
});
