import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };

  const mockUser = {
    id: 'user-uuid-1',
    name: 'Pedro Miranda',
    email: 'pedro@example.com',
    password: '$2b$10$hashedvalue',
    salt: '$2b$10$generateduniquesalt',
    root: false,
    del: false,
    githubId: 'gh-user-123',
    profilePictureUrl: null,
    refreshToken: 'stored-refresh-token',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('AC-8: calls bcrypt.genSalt() and stores unique salt per user', async () => {
      // Arrange
      const bcrypt = await import('bcrypt');
      const genSaltSpy = jest.spyOn(bcrypt, 'genSalt');
      const hashSpy = jest.spyOn(bcrypt, 'hash');

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const dto = {
        name: 'Pedro Miranda',
        email: 'pedro@example.com',
        password: 'password123',
      };

      // Act
      await service.create(dto);

      // Assert
      expect(genSaltSpy).toHaveBeenCalled();
      expect(hashSpy).toHaveBeenCalled();

      genSaltSpy.mockRestore();
      hashSpy.mockRestore();
    });

    it('AC-8: returned UserResponseDto does not expose password, salt or refreshToken', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const dto = {
        name: 'Pedro Miranda',
        email: 'pedro@example.com',
        password: 'password123',
      };

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('salt');
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('throws ConflictException when email already exists', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const dto = {
        name: 'Duplicate',
        email: 'pedro@example.com',
        password: 'password123',
      };

      // Act
      const promise = service.create(dto);

      // Assert
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAll', () => {
    it('AC-9: filters by search term across name, email and githubId', async () => {
      // Arrange
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);

      // Act
      await service.findAll({
        search: 'pedro',
        del: 'false',
        page: 1,
        limit: 10,
      } as any);

      // Assert
      const findManyCall = prisma.user.findMany.mock.calls[0][0];
      expect(JSON.stringify(findManyCall.where)).toMatch(/pedro/);
    });

    it('AC-9: filters del=false to return only active users', async () => {
      // Arrange
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);

      // Act
      await service.findAll({ del: 'false', page: 1, limit: 10 } as any);

      // Assert
      const findManyCall = prisma.user.findMany.mock.calls[0][0];
      expect(JSON.stringify(findManyCall.where)).toContain('false');
    });

    it('returns paginated result shape { data, total, page, limit }', async () => {
      // Arrange
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);

      // Act
      const result = await service.findAll({ page: 1, limit: 10 } as any);

      // Assert
      expect(result).toMatchObject({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 10,
      });
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when user does not exist', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act
      const promise = service.findById('non-existent-id');

      // Assert
      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns UserResponseDto without sensitive fields', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.findById(mockUser.id);

      // Assert
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('salt');
      expect(result).not.toHaveProperty('refreshToken');
    });
  });

  describe('update', () => {
    it('re-hashes password when new password is provided', async () => {
      // Arrange
      const bcrypt = await import('bcrypt');
      const genSaltSpy = jest.spyOn(bcrypt, 'genSalt');
      const hashSpy = jest.spyOn(bcrypt, 'hash');

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, name: 'Updated' });

      // Act
      await service.update(mockUser.id, { password: 'newpassword123' });

      // Assert
      expect(genSaltSpy).toHaveBeenCalled();
      expect(hashSpy).toHaveBeenCalled();

      genSaltSpy.mockRestore();
      hashSpy.mockRestore();
    });

    it('throws ConflictException when updated email already belongs to another user', async () => {
      // Arrange
      const existingUser = { ...mockUser, id: 'different-uuid' };
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // findById
        .mockResolvedValueOnce(existingUser); // email conflict check

      // Act
      const promise = service.update(mockUser.id, {
        email: 'pedro@example.com',
      });

      // Assert
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('softDelete', () => {
    it('AC-10: sets del=true without physical deletion', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, del: true });

      // Act
      await service.softDelete(mockUser.id);

      // Assert
      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data).toMatchObject({ del: true });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('regenerateToken', () => {
    it('updates refreshToken in DB and returns token string', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        refreshToken: 'new-refresh-token',
      });

      // Act
      const result = await service.regenerateToken(mockUser.id);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({ refreshToken: expect.any(String) }),
        }),
      );
    });
  });

  describe('findByGithubId', () => {
    it('returns the matching user when githubId exists', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByGithubId('gh-user-123');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.githubId).toBe('gh-user-123');
    });

    it('returns null when no user has the given githubId', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.findByGithubId('unknown-github-id');

      // Assert
      expect(result).toBeNull();
    });
  });
});
