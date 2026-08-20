import { Test } from '@nestjs/testing';
import { FeedsService } from './feeds.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';

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
    feedPost: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    socialPost: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'p1', network: 'x', postId: '123' }),
      update: jest.fn().mockResolvedValue({ id: 'p1', content: 'nuevo' }),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };
  const auditMock = { log: jest.fn() };
  const actor = { id: 'u1', email: 'a@minfin.gob.gt', role: 'admin' };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeedsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        { provide: SettingsService, useValue: { get: jest.fn().mockResolvedValue({ officialAccounts: {} }) } },
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

  it('adds a new post to a feed by extracting the ID from an X URL', async () => {
    const result = await service.addPost(
      'f1',
      { urlOrId: 'https://x.com/MinfinGT/status/1234567890', network: 'x' },
      actor,
    );
    expect(result.success).toBe(true);
    expect(prismaMock.socialPost.create).toHaveBeenCalled();
  });

  it('reorders posts by writing the order column for each FeedPost row', async () => {
    await service.reorderPosts('f1', ['p2', 'p1'], actor);
    expect(prismaMock.feedPost.update).toHaveBeenCalledTimes(2);
  });
});
