import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findAllActive(): Promise<Omit<User, 'passwordHash'>[]> {
    return this.usersRepository.find({
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
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update({ id }, { passwordHash });
  }
}
