import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { User, UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let repository: {
    findOneBy: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

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
    repository = {
      findOneBy: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto: Partial<User>) => dto),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('findByEmail returns the matching user', async () => {
    repository.findOneBy.mockResolvedValue(mockUser);

    const result = await service.findByEmail(mockUser.email);

    expect(result).toEqual(mockUser);
    expect(repository.findOneBy).toHaveBeenCalledWith({
      email: mockUser.email,
    });
  });

  it('findByEmail returns null when no user matches', async () => {
    repository.findOneBy.mockResolvedValue(null);

    const result = await service.findByEmail('missing@collectify.com');

    expect(result).toBeNull();
  });

  it('findById returns the matching user', async () => {
    repository.findOneBy.mockResolvedValue(mockUser);

    const result = await service.findById(mockUser.id);

    expect(result).toEqual(mockUser);
    expect(repository.findOneBy).toHaveBeenCalledWith({ id: mockUser.id });
  });

  describe('findAll', () => {
    it('selects only active users without the password hash by default', async () => {
      repository.find.mockResolvedValue([mockUser]);

      const result = await service.findAll({});

      expect(result).toEqual([mockUser]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        select: [
          'id',
          'fullName',
          'email',
          'role',
          'isActive',
          'createdAt',
          'updatedAt',
        ],
        order: { createdAt: 'DESC' },
      });
    });

    it('lists deactivated users when isActive=false is requested', async () => {
      repository.find.mockResolvedValue([]);

      await service.findAll({ isActive: false });

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });
  });

  describe('create', () => {
    const createDto = {
      fullName: 'Ana Torres',
      email: 'ana@collectify.com',
      password: 'a-strong-password',
      role: UserRole.Collector,
    };

    beforeEach(() => {
      repository.findOneBy.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      repository.save.mockImplementation((user: Partial<User>) =>
        Promise.resolve({ ...mockUser, ...user, id: 'user-2' }),
      );
    });

    it('creates the user with a hashed password and excludes it from the result', async () => {
      const result = await service.create(createDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('a-strong-password', 10);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Ana Torres',
          email: 'ana@collectify.com',
          passwordHash: 'hashed-password',
          role: UserRole.Collector,
          isActive: true,
        }),
      );
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('ana@collectify.com');
    });

    it('rejects a duplicate email', async () => {
      repository.findOneBy.mockResolvedValue(mockUser);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false for another user', async () => {
      repository.findOneBy.mockResolvedValue({ ...mockUser });
      repository.save.mockImplementation((user: User) => Promise.resolve(user));

      const result = await service.deactivate('user-2', 'admin-1');

      expect(result.isActive).toBe(false);
    });

    it('rejects deactivating your own account', async () => {
      await expect(service.deactivate('admin-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.findOneBy).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the user does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.deactivate('missing-id', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reactivate', () => {
    it('sets isActive to true', async () => {
      repository.findOneBy.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      repository.save.mockImplementation((user: User) => Promise.resolve(user));

      const result = await service.reactivate('user-2');

      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.reactivate('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it('updatePasswordHash updates the stored hash for the given user', async () => {
    await service.updatePasswordHash(mockUser.id, 'new-hash');

    expect(repository.update).toHaveBeenCalledWith(
      { id: mockUser.id },
      { passwordHash: 'new-hash' },
    );
  });
});
