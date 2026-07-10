import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

import { AuthService } from './auth.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    updatePasswordHash: jest.Mock;
  };
  let jwtService: { sign: jest.Mock; verifyAsync: jest.Mock };

  const mockUser: User = {
    id: 'user-1',
    fullName: 'Test Owner',
    email: 'owner@collectify.com',
    passwordHash: 'stored-hash',
    role: UserRole.Admin,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updatePasswordHash: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verifyAsync: jest.fn(),
    };
    const configService = {
      get: jest.fn().mockReturnValue({
        secret: 'test-secret',
        accessExpiration: '15m',
        refreshExpiration: '7d',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('login', () => {
    it('returns an access and refresh token on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: mockUser.email,
        password: 'correct-password',
      });

      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('throws UnauthorizedException when the email does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@collectify.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password is wrong', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: mockUser.email, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the user is inactive', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.login({ email: mockUser.email, password: 'correct-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('returns a new access token for a valid refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        type: 'refresh',
      });
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.refresh({ refreshToken: 'valid-refresh' });

      expect(result).toEqual({ accessToken: 'signed-token' });
    });

    it('throws UnauthorizedException when the token is invalid or expired', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.refresh({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when given an access token instead of a refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        type: 'access',
      });

      await expect(
        service.refresh({ refreshToken: 'access-token-used-as-refresh' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        type: 'refresh',
      });
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken: 'valid-refresh' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('updates the password hash when the current password is correct', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      await service.changePassword(mockUser.id, {
        currentPassword: 'correct-password',
        newPassword: 'new-strong-password',
      });

      expect(usersService.updatePasswordHash).toHaveBeenCalledWith(
        mockUser.id,
        'new-hashed-password',
      );
    });

    it('throws UnauthorizedException when the current password is wrong', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(mockUser.id, {
          currentPassword: 'wrong-password',
          newPassword: 'new-strong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('missing-user', {
          currentPassword: 'x',
          newPassword: 'new-strong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
