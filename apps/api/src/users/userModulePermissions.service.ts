import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  AppModule,
  UserModulePermission,
} from './entities/userModulePermission.entity';
import { User } from './entities/user.entity';

// Row presence = granted (see the entity's doc comment) — only ever
// populated for collector accounts; an admin's rows, if any exist from a
// role change, are simply never consulted by the guard. See
// docs/phases/PHASE_20_MODULE_PERMISSIONS.md.
@Injectable()
export class UserModulePermissionsService {
  constructor(
    @InjectRepository(UserModulePermission)
    private readonly permissionsRepository: Repository<UserModulePermission>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async getModulesForUser(userId: string): Promise<AppModule[]> {
    const rows = await this.permissionsRepository.find({
      where: { userId },
      select: ['module'],
    });
    return rows.map((row) => row.module);
  }

  // Batched — one query per user instead of N — for UsersService.findAll,
  // which needs every listed user's modules at once.
  async getModulesForUsers(
    userIds: string[],
  ): Promise<Map<string, AppModule[]>> {
    const result = new Map<string, AppModule[]>(userIds.map((id) => [id, []]));
    if (userIds.length === 0) {
      return result;
    }

    const rows = await this.permissionsRepository
      .createQueryBuilder('permission')
      .select(['permission.userId', 'permission.module'])
      .where('permission.userId IN (:...userIds)', { userIds })
      .getMany();

    for (const row of rows) {
      result.get(row.userId)?.push(row.module);
    }
    return result;
  }

  // Replaces the full set for this user — delete then bulk-insert inside
  // a transaction so a partial write is never observable.
  async setModulesForUser(
    userId: string,
    modules: AppModule[],
  ): Promise<AppModule[]> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const uniqueModules = [...new Set(modules)];

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(UserModulePermission);
      await repository.delete({ userId });
      if (uniqueModules.length > 0) {
        await repository.insert(
          uniqueModules.map((module) => ({ userId, module })),
        );
      }
    });

    return uniqueModules;
  }
}
