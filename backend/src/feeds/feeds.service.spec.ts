import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FeedsService } from './feeds.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { AuthService } from '../auth/auth.service';

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
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ ...feedRow, posts: [], portals: [] }),
      findFirst: jest.fn().mockResolvedValue({ ...feedRow, posts: [] }),
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
      create: jest
        .fn()
        .mockResolvedValue({ id: 'p1', network: 'x', postId: '123' }),
      update: jest.fn().mockResolvedValue({ id: 'p1', content: 'nuevo' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ mfaEnabled: false }),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };
  const auditMock = { log: jest.fn() };
  const authMock = { verifyMfaCode: jest.fn().mockResolvedValue('valid') };
  const actor = { id: 'u1', email: 'a@minfin.gob.gt', role: 'admin' };

  beforeEach(() => {
    prismaMock.feedPost.update.mockClear();
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network disabled in unit tests'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeedsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        {
          provide: SettingsService,
          useValue: {
            get: jest.fn().mockResolvedValue({ officialAccounts: {} }),
          },
        },
        { provide: AuthService, useValue: authMock },
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

  describe('step-up MFA on feed publication changes', () => {
    const withMfa = () => {
      prismaMock.user.findUnique.mockResolvedValue({ mfaEnabled: true });
    };
    afterEach(() => {
      prismaMock.user.findUnique.mockResolvedValue({ mfaEnabled: false });
      authMock.verifyMfaCode.mockResolvedValue('valid');
      prismaMock.feed.update.mockClear();
      prismaMock.feed.delete.mockClear();
      authMock.verifyMfaCode.mockClear();
    });

    it('requires a valid code to change the status', async () => {
      withMfa();
      authMock.verifyMfaCode.mockResolvedValue('invalid');
      await expect(
        service.update('f1', { status: 'paused' }, actor),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.feed.update).not.toHaveBeenCalled();
    });

    it('requires a valid code to change the slug', async () => {
      withMfa();
      authMock.verifyMfaCode.mockResolvedValue('invalid');
      await expect(
        service.update('f1', { slug: 'otro-slug' }, actor),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.feed.update).not.toHaveBeenCalled();
    });

    it('applies the change and never sends mfaCode to the database when the code is valid', async () => {
      withMfa();
      await service.update(
        'f1',
        { status: 'paused', mfaCode: '123456' },
        actor,
      );
      expect(authMock.verifyMfaCode).toHaveBeenCalledWith('u1', '123456');
      const data = prismaMock.feed.update.mock.calls[0][0].data;
      expect(data.status).toBe('paused');
      expect(data).not.toHaveProperty('mfaCode');
    });

    it('does not ask for a code to edit name, description or layout', async () => {
      withMfa();
      await service.update(
        'f1',
        { name: 'Nuevo nombre', layoutDefault: 'list' },
        actor,
      );
      expect(authMock.verifyMfaCode).not.toHaveBeenCalled();
      expect(prismaMock.feed.update).toHaveBeenCalled();
    });

    it('does not ask for a code when the status or slug is re-sent unchanged', async () => {
      withMfa();
      await service.update(
        'f1',
        { status: 'active', slug: 'x-comunicados', name: 'Igual' },
        actor,
      );
      expect(authMock.verifyMfaCode).not.toHaveBeenCalled();
    });

    it('does not ask for a code when the user has no MFA configured', async () => {
      await service.update('f1', { status: 'paused' }, actor);
      expect(authMock.verifyMfaCode).not.toHaveBeenCalled();
      expect(prismaMock.feed.update).toHaveBeenCalled();
    });

    it('requires a valid code to delete a feed', async () => {
      withMfa();
      authMock.verifyMfaCode.mockResolvedValue('invalid');
      await expect(service.remove('f1', actor)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prismaMock.feed.delete).not.toHaveBeenCalled();
    });

    it('deletes the feed with a valid code', async () => {
      withMfa();
      await service.remove('f1', actor, '123456');
      expect(prismaMock.feed.delete).toHaveBeenCalled();
    });

    it('keeps duplicate and reorder free of step-up', async () => {
      withMfa();
      await service.duplicate('f1', actor);
      await service.reorderPosts('f1', ['p2', 'p1'], actor);
      expect(authMock.verifyMfaCode).not.toHaveBeenCalled();
    });
  });

  describe('post URL safety', () => {
    const mixedFeed = {
      ...feedRow,
      network: 'mixed',
      posts: [],
      portals: [],
    };

    beforeEach(() => {
      prismaMock.feed.findUniqueOrThrow.mockResolvedValueOnce(mixedFeed);
      prismaMock.socialPost.create.mockClear();
    });

    it.each([
      ['tiktok', 'javascript:alert(1)'],
      ['tiktok', 'data:text/html;base64,PHNjcmlwdD4='],
      ['tiktok', 'ftp://example.com/video'],
      ['linkedin', 'javascript:alert(1)'],
    ])('rejects a %s post whose URL is %s', async (network, urlOrId) => {
      await expect(
        service.addPost('f1', { urlOrId, network }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.socialPost.create).not.toHaveBeenCalled();
    });

    it('rejects a LinkedIn post that points outside linkedin.com', async () => {
      await expect(
        service.addPost(
          'f1',
          { urlOrId: 'https://evil.example.com/phish', network: 'linkedin' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.socialPost.create).not.toHaveBeenCalled();
    });

    it('accepts a LinkedIn URN and builds the linkedin.com embed URL', async () => {
      const result = await service.addPost(
        'f1',
        { urlOrId: 'urn:li:share:7000000000000000001', network: 'linkedin' },
        actor,
      );
      expect(result.success).toBe(true);
      expect(prismaMock.socialPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            url: expect.stringMatching(/^https:\/\/www\.linkedin\.com\/embed\//),
          }),
        }),
      );
    });

    it('upgrades a pasted http:// URL to https instead of rejecting it', async () => {
      const result = await service.addPost(
        'f1',
        {
          urlOrId: 'http://www.tiktok.com/@minfin/video/123',
          network: 'tiktok',
          customContent: 'texto propio',
        },
        actor,
      );
      expect(result.success).toBe(true);
      expect(prismaMock.socialPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            url: 'https://www.tiktok.com/@minfin/video/123',
          }),
        }),
      );
    });

    it('keeps accepting a bare Facebook post ID (not a navigable URL)', async () => {
      const result = await service.addPost(
        'f1',
        { urlOrId: '1234567890123456', network: 'facebook' },
        actor,
      );
      expect(result.success).toBe(true);
    });

    it('drops non-https thumbnails returned by third parties', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            title: 't',
            author_name: 'a',
            thumbnail_url: 'javascript:alert(1)',
          }),
      }) as unknown as typeof fetch;
      await service.addPost(
        'f1',
        { urlOrId: 'https://youtu.be/dQw4w9WgXcQ', network: 'youtube' },
        actor,
      );
      const data = prismaMock.socialPost.create.mock.calls[0][0].data;
      expect(data.mediaThumb).toBeUndefined();
    });
  });

  it('reorders posts by writing the order column for each FeedPost row', async () => {
    await service.reorderPosts('f1', ['p2', 'p1'], actor);
    expect(prismaMock.feedPost.update).toHaveBeenCalledTimes(2);
  });

  it('only serves active feeds publicly, so drafts and paused feeds stay hidden', async () => {
    await service.findPublicBySlug('x-comunicados');

    // El filtro por estado va en la consulta: un feed en borrador o pausado no
    // debe ser legible por un llamante anónimo, y pausar tiene que retirarlo
    // de los portales de verdad.
    expect(prismaMock.feed.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'x-comunicados', status: 'active' },
      }),
    );
  });

  it('returns 404 for a feed that exists but is not active', async () => {
    prismaMock.feed.findFirst.mockResolvedValueOnce(null);
    await expect(service.findPublicBySlug('borrador-interno')).rejects.toThrow(
      'Feed no encontrado',
    );
  });
});
