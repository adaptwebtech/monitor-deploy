import { UsersService } from '../users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsersService — findByGithubIdCached (github-user-picture feature)', () => {
  let service: UsersService;

  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };

  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
  };

  const mockPrismaUser = {
    id: 'user-uuid-gh-1',
    name: 'Pedro PHP',
    email: 'pedro@example.com',
    password: '$2b$10$hashed',
    salt: '$2b$10$salt',
    root: false,
    del: false,
    githubId: 'pedro-php',
    profilePictureUrl: 'https://avatars.githubusercontent.com/u/12345',
    refreshToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    // Instantiate with prisma and inject cacheManager via property
    // (implementation will inject CACHE_MANAGER via constructor token)
    service = new UsersService(
      prisma as unknown as PrismaService,
      cacheManager as unknown as {
        get: (k: string) => unknown;
        set: (k: string, v: unknown, ttl: number) => unknown;
      },
    );
  });

  describe('AC-6: cache hit — DB not consulted', () => {
    it('AC-6: returns cached DTO immediately without calling prisma.user.findFirst', async () => {
      // Arrange
      const cached = {
        name: 'Pedro PHP',
        profilePictureUrl: 'https://avatars.githubusercontent.com/u/12345',
      };
      cacheManager.get.mockResolvedValue(cached);

      // Act
      const result = await service.findByGithubIdCached('pedro-php');

      // Assert
      expect(cacheManager.get).toHaveBeenCalledWith('github_user:pedro-php');
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });
  });

  describe('AC-4: cache miss + user found → sets Redis TTL 3600', () => {
    it('AC-4: queries DB, sets cache with TTL 3600, returns GithubUserResolutionDto', async () => {
      // Arrange
      cacheManager.get.mockResolvedValue(undefined); // cache miss
      prisma.user.findFirst.mockResolvedValue(mockPrismaUser);
      cacheManager.set.mockResolvedValue(undefined);

      // Act
      const result = await service.findByGithubIdCached('pedro-php');

      // Assert
      const findFirstCall = prisma.user.findFirst.mock.calls[0] as [
        { where: { githubId: string; del: boolean } },
      ];
      expect(findFirstCall[0].where.githubId).toBe('pedro-php');
      expect(findFirstCall[0].where.del).toBe(false);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'github_user:pedro-php',
        expect.objectContaining({ name: 'Pedro PHP' }),
        expect.any(Number),
      );
      const [, , ttl] = cacheManager.set.mock.calls[0] as [
        string,
        unknown,
        number,
      ];
      expect(ttl).toBeLessThanOrEqual(3600);
      expect(ttl).toBeGreaterThan(0);
      expect(result).toMatchObject({
        name: 'Pedro PHP',
        profilePictureUrl: 'https://avatars.githubusercontent.com/u/12345',
      });
    });
  });

  describe('AC-5: cache miss + user NOT found → sets Redis sentinel TTL 300', () => {
    it('AC-5: queries DB, sets cache sentinel with TTL ≤ 300, returns null', async () => {
      // Arrange
      cacheManager.get.mockResolvedValue(undefined); // cache miss
      prisma.user.findFirst.mockResolvedValue(null);
      cacheManager.set.mockResolvedValue(undefined);

      // Act
      const result = await service.findByGithubIdCached('unknown-id');

      // Assert
      expect(prisma.user.findFirst).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalledWith(
        'github_user:unknown-id',
        '__NOT_FOUND__',
        expect.any(Number),
      );
      const [, , ttl] = cacheManager.set.mock.calls[0] as [
        string,
        unknown,
        number,
      ];
      expect(ttl).toBeLessThanOrEqual(300);
      expect(ttl).toBeGreaterThan(0);
      expect(result).toBeNull();
    });
  });

  describe('Redis resilience — get throws → falls through to DB', () => {
    it('proceeds to DB query when cacheManager.get throws', async () => {
      // Arrange
      cacheManager.get.mockRejectedValue(new Error('Redis connection refused'));
      prisma.user.findFirst.mockResolvedValue(mockPrismaUser);
      cacheManager.set.mockResolvedValue(undefined);

      // Act
      const result = await service.findByGithubIdCached('pedro-php');

      // Assert
      expect(prisma.user.findFirst).toHaveBeenCalled();
      expect(result).toMatchObject({ name: 'Pedro PHP' });
    });
  });
});
