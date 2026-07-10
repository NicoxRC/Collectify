import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { User, UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: { findOneBy: jest.Mock; find: jest.Mock; update: jest.Mock };

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

  it('findAllActive selects only active users without the password hash', async () => {
    repository.find.mockResolvedValue([mockUser]);

    const result = await service.findAllActive();

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
