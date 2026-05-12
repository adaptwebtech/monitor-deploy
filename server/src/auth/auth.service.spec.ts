import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'user-uuid-1',
    name: 'Pedro Miranda',
    email: 'pedro@example.com',
    password: '$2b$10$hashedpassword',
    salt: '$2b$10$uniquesalt',
    root: false,
    del: false,
    refreshToken: 'existing-refresh-token',
    githubId: null,
    profilePictureUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findByGithubId: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    service = new AuthService(usersService, jwtService);

    jest.resetAllMocks();

    usersService = {
      findByEmail: jest.fn(),
      findByGithubId: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    service = new AuthService(usersService, jwtService);
  });

  describe('login', () => {
    it('AC-6: returns accessToken, refreshToken and user on valid credentials', async () => {
      // Arrange
      const bcrypt = await import('bcrypt');
      const plainPassword = 'validpassword123';
      const hashed = await bcrypt.hash(plainPassword, 10);
      const user = { ...mockUser, password: hashed };

      usersService.findByEmail.mockResolvedValue(user);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      usersService.update.mockResolvedValue({
        ...user,
        refreshToken: 'refresh-token',
      } as any);

      // Act
      const result = await service.login(user.email, plainPassword);

      // Assert
      expect(result).toMatchObject({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(result.user).toBeDefined();
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      // Arrange
      const bcrypt = await import('bcrypt');
      const hashed = await bcrypt.hash('correct-password', 10);
      const user = { ...mockUser, password: hashed };

      usersService.findByEmail.mockResolvedValue(user);

      // Act
      const promise = service.login(user.email, 'wrong-password');

      // Assert
      await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when email is not found', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);

      // Act
      const promise = service.login('notfound@example.com', 'anypassword');

      // Assert
      await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when user has del=true', async () => {
      // Arrange
      const bcrypt = await import('bcrypt');
      const plainPassword = 'validpassword123';
      const hashed = await bcrypt.hash(plainPassword, 10);
      const deletedUser = { ...mockUser, del: true, password: hashed };

      usersService.findByEmail.mockResolvedValue(deletedUser);

      // Act
      const promise = service.login(deletedUser.email, plainPassword);

      // Assert
      await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('AC-6: signs refreshToken WITHOUT expiresIn option', async () => {
      // Arrange
      const bcrypt = await import('bcrypt');
      const plainPassword = 'validpassword123';
      const hashed = await bcrypt.hash(plainPassword, 10);
      const user = { ...mockUser, password: hashed };

      usersService.findByEmail.mockResolvedValue(user);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      usersService.update.mockResolvedValue(user);

      // Act
      await service.login(user.email, plainPassword);

      // Assert
      // Second sign call (refreshToken) must NOT contain expiresIn
      const refreshSignCall = jwtService.sign.mock.calls[1];
      const refreshSignOptions =
        refreshSignCall?.[1] ?? refreshSignCall?.[2] ?? {};
      expect(refreshSignOptions).not.toHaveProperty('expiresIn');
    });
  });

  describe('refresh', () => {
    it('AC-7: returns new accessToken when refreshToken matches DB', async () => {
      // Arrange
      const payload = { sub: mockUser.id, email: mockUser.email };
      const storedUser = { ...mockUser, refreshToken: 'valid-refresh-token' };

      jwtService.verify.mockReturnValue(payload);
      usersService.findByEmail.mockResolvedValue(storedUser);
      jwtService.sign.mockReturnValue('new-access-token');

      // Act
      const result = await service.refresh('valid-refresh-token');

      // Assert
      expect(result).toMatchObject({ accessToken: 'new-access-token' });
    });

    it('throws UnauthorizedException when token does not match DB value', async () => {
      // Arrange
      const payload = { sub: mockUser.id, email: mockUser.email };
      const storedUser = { ...mockUser, refreshToken: 'different-token-in-db' };

      jwtService.verify.mockReturnValue(payload);
      usersService.findByEmail.mockResolvedValue(storedUser);

      // Act
      const promise = service.refresh('presented-refresh-token');

      // Assert
      await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when verify throws (invalid token)', async () => {
      // Arrange
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      // Act
      const promise = service.refresh('malformed-token');

      // Assert
      await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
