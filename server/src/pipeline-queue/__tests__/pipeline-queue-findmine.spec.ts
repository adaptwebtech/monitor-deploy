import { PipelineQueueService } from '../pipeline-queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PipelineQueueQueryDto } from '../dto/pipeline-queue-query.dto';

type FindManyCallArg = {
  where?: Record<string, unknown>;
  skip?: number;
  take?: number;
  orderBy?: unknown;
};

describe('PipelineQueueService — findMine regression (REG-1..5)', () => {
  let service: PipelineQueueService;
  let prisma: {
    pipelineQueue: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };

  const baseQuery: PipelineQueueQueryDto = { page: '1', limit: '10' };

  const mockPipelineWebhook = {
    id: 'pipe-webhook-1',
    event: 'push',
    app: 'whiz-server',
    environment: 'development',
    commitSha: 'deadbeef',
    commitMessage: 'chore: bump deps',
    commitAuthor: 'pedro-php',
    commitAuthorAvatar: 'https://avatars.githubusercontent.com/u/99999?v=4',
    commitAuthorId: '99999',
    status: 'Completed',
    id_user: null,
    del: false,
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
  };

  const mockPipelineLegacy = {
    id: 'pipe-legacy-1',
    event: 'push',
    app: 'whiz-server',
    environment: 'production',
    commitSha: 'cafebabe',
    commitMessage: 'fix: prod issue',
    commitAuthor: 'other-author',
    commitAuthorAvatar: null,
    commitAuthorId: '00000',
    status: 'Completed',
    id_user: 'user-uuid-1',
    del: false,
    createdAt: new Date('2025-01-02T10:00:00Z'),
    updatedAt: new Date('2025-01-02T10:00:00Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    prisma = {
      pipelineQueue: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    service = new PipelineQueueService(prisma as unknown as PrismaService);
  });

  function getFindManyCalls(): FindManyCallArg[] {
    return (
      prisma.pipelineQueue.findMany.mock.calls as Array<[FindManyCallArg]>
    ).map((call) => call[0]);
  }

  it('REG-1: retorna deploys onde commitAuthorId = githubId e id_user = null', async () => {
    // Arrange — user has githubId; pipeline has commitAuthorId matching it, id_user=null
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-uuid-1',
      githubId: '99999',
    });
    prisma.pipelineQueue.findMany.mockResolvedValue([mockPipelineWebhook]);
    prisma.pipelineQueue.count.mockResolvedValue(1);

    // Act
    const result = await service.findMine('user-uuid-1', baseQuery);

    // Assert — result must contain the webhook-created pipeline
    expect(result.data.length).toBeGreaterThan(0);

    // The where clause passed to prisma must include an OR covering commitAuthorId
    const where = getFindManyCalls()[0].where as Record<string, unknown>;
    const whereStr = JSON.stringify(where);
    expect(whereStr).toContain('commitAuthorId');
    expect(whereStr).toContain('99999');
  });

  it('REG-2: retorna deploys vinculados por id_user (fluxo legado)', async () => {
    // Arrange — user has githubId; pipeline linked by id_user (legacy)
    // After the fix, findMine must look up githubId via prisma.user.findUnique
    // before building the OR where clause; assert that lookup happens.
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-uuid-1',
      githubId: '99999',
    });
    prisma.pipelineQueue.findMany.mockResolvedValue([mockPipelineLegacy]);
    prisma.pipelineQueue.count.mockResolvedValue(1);

    // Act
    await service.findMine('user-uuid-1', baseQuery);

    // Assert — prisma.user.findUnique must be called to resolve githubId
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({ id: 'user-uuid-1' }),
      }),
    );

    // The where clause must contain id_user (legacy arm of OR)
    const where = getFindManyCalls()[0].where as Record<string, unknown>;
    const whereStr = JSON.stringify(where);
    expect(whereStr).toContain('id_user');
    expect(whereStr).toContain('user-uuid-1');
  });

  it('REG-3: usuário sem githubId filtra apenas por id_user sem erro', async () => {
    // Arrange — user has no githubId (null)
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-uuid-2',
      githubId: null,
    });
    prisma.pipelineQueue.findMany.mockResolvedValue([mockPipelineLegacy]);
    prisma.pipelineQueue.count.mockResolvedValue(1);

    // Act — must not throw
    let result: Awaited<ReturnType<typeof service.findMine>> | undefined;
    let thrown: unknown;
    try {
      result = await service.findMine('user-uuid-2', baseQuery);
    } catch (e) {
      thrown = e;
    }

    // Assert — no error, returns normally
    expect(thrown).toBeUndefined();
    expect(result).toBeDefined();

    // prisma.user.findUnique must have been called to discover githubId
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({ id: 'user-uuid-2' }),
      }),
    );

    // The where clause must filter by id_user only (githubId was null → no commitAuthorId arm)
    const where = getFindManyCalls()[0].where as Record<string, unknown>;
    const whereStr = JSON.stringify(where);
    expect(whereStr).toContain('id_user');
    expect(whereStr).toContain('user-uuid-2');
    expect(whereStr).not.toContain('commitAuthorId');
  });

  it('REG-5: retorna deploy onde commitAuthor = githubId (commitAuthorId numérico não bate)', async () => {
    // Real-world case: webhook sends commitAuthorId = numeric GitHub user ID ("99999")
    // but user.githubId stores the login string ("pedro-php").
    // commitAuthor = login → should match via commitAuthor = githubId arm.
    const pipelineLoginAuthor = {
      ...mockPipelineWebhook,
      id: 'pipe-login-author',
      commitAuthorId: '99999',
      id_user: null,
      commitAuthor: 'pedro-php',
      steps: [],
    };

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-uuid-1',
      githubId: 'pedro-php',
    });
    prisma.pipelineQueue.findMany.mockResolvedValue([pipelineLoginAuthor]);
    prisma.pipelineQueue.count.mockResolvedValue(1);

    const result = await service.findMine('user-uuid-1', baseQuery);

    expect(result.data.length).toBeGreaterThan(0);

    const where = getFindManyCalls()[0].where as Record<string, unknown>;
    const orClause = JSON.stringify((where as { OR?: unknown[] }).OR ?? []);
    // Must contain a clause matching by commitAuthor (not commitAuthorId)
    expect(orClause).toContain('"commitAuthor":"pedro-php"');
  });

  it('REG-4: retorna lista vazia quando usuário não tem deploys', async () => {
    // Arrange — user has githubId but no matching records
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-uuid-3',
      githubId: '11111',
    });
    prisma.pipelineQueue.findMany.mockResolvedValue([]);
    prisma.pipelineQueue.count.mockResolvedValue(0);

    // Act
    const result = await service.findMine('user-uuid-3', baseQuery);

    // Assert — empty response
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);

    // Even with no results, prisma.user.findUnique must have been called
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({ id: 'user-uuid-3' }),
      }),
    );
  });
});
