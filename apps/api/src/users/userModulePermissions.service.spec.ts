import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { User, UserRole } from './entities/user.entity';
import {
  AppModule,
  UserModulePermission,
} from './entities/userModulePermission.entity';
import { UserModulePermissionsService } from './userModulePermissions.service';

describe('UserModulePermissionsService', () => {
  let service: UserModulePermissionsService;
  let permissionsRepository: {
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let usersRepository: { findOneBy: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let transactionRepository: { delete: jest.Mock; insert: jest.Mock };

  const mockUser: User = {
    id: 'user-2',
    fullName: 'Ana Torres',
    email: 'ana@collectify.com',
    passwordHash: 'hash',
    role: UserRole.Collector,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    permissionsRepository = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    usersRepository = { findOneBy: jest.fn() };
    transactionRepository = {
      delete: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (work: (manager: EntityManager) => Promise<unknown>) => {
            const manager = {
              getRepository: () => transactionRepository,
            } as unknown as EntityManager;
            return work(manager);
          },
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserModulePermissionsService,
        {
          provide: getRepositoryToken(UserModulePermission),
          useValue: permissionsRepository,
        },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<UserModulePermissionsService>(
      UserModulePermissionsService,
    );
  });

  describe('getModulesForUser', () => {
    it("returns the user's granted modules", async () => {
      permissionsRepository.find.mockResolvedValue([
        { module: AppModule.Clients },
        { module: AppModule.Loans },
      ]);

      const result = await service.getModulesForUser('user-2');

      expect(result).toEqual([AppModule.Clients, AppModule.Loans]);
      expect(permissionsRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-2' },
        select: ['module'],
      });
    });

    it('returns an empty array when nothing has been granted', async () => {
      permissionsRepository.find.mockResolvedValue([]);

      const result = await service.getModulesForUser('user-2');

      expect(result).toEqual([]);
    });
  });

  describe('getModulesForUsers', () => {
    it('groups modules by user id, defaulting to an empty array for each requested id', async () => {
      const getMany = jest.fn().mockResolvedValue([
        { userId: 'user-2', module: AppModule.Clients },
        { userId: 'user-2', module: AppModule.Loans },
        { userId: 'user-3', module: AppModule.Messages },
      ]);
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany,
      };
      permissionsRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getModulesForUsers([
        'user-2',
        'user-3',
        'user-4',
      ]);

      expect(result.get('user-2')).toEqual([
        AppModule.Clients,
        AppModule.Loans,
      ]);
      expect(result.get('user-3')).toEqual([AppModule.Messages]);
      expect(result.get('user-4')).toEqual([]);
    });

    it('skips the query entirely for an empty id list', async () => {
      const result = await service.getModulesForUsers([]);

      expect(result.size).toBe(0);
      expect(permissionsRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('setModulesForUser', () => {
    it('replaces the full set inside a transaction', async () => {
      usersRepository.findOneBy.mockResolvedValue(mockUser);

      const result = await service.setModulesForUser('user-2', [
        AppModule.Clients,
        AppModule.Loans,
      ]);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(transactionRepository.delete).toHaveBeenCalledWith({
        userId: 'user-2',
      });
      expect(transactionRepository.insert).toHaveBeenCalledWith([
        { userId: 'user-2', module: AppModule.Clients },
        { userId: 'user-2', module: AppModule.Loans },
      ]);
      expect(result).toEqual([AppModule.Clients, AppModule.Loans]);
    });

    it('de-duplicates repeated modules before inserting', async () => {
      usersRepository.findOneBy.mockResolvedValue(mockUser);

      const result = await service.setModulesForUser('user-2', [
        AppModule.Clients,
        AppModule.Clients,
      ]);

      expect(transactionRepository.insert).toHaveBeenCalledWith([
        { userId: 'user-2', module: AppModule.Clients },
      ]);
      expect(result).toEqual([AppModule.Clients]);
    });

    it('deletes existing rows without inserting when the new set is empty', async () => {
      usersRepository.findOneBy.mockResolvedValue(mockUser);

      await service.setModulesForUser('user-2', []);

      expect(transactionRepository.delete).toHaveBeenCalledWith({
        userId: 'user-2',
      });
      expect(transactionRepository.insert).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the user does not exist', async () => {
      usersRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.setModulesForUser('missing-id', [AppModule.Clients]),
      ).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
