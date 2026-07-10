import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { CreateUserDto } from './dto/createUser.dto';
import { QueryUsersDto } from './dto/queryUsers.dto';
import { User } from './entities/user.entity';

const BCRYPT_SALT_ROUNDS = 10;
const POSTGRES_UNIQUE_VIOLATION = '23505';
const PUBLIC_USER_FIELDS = [
  'id',
  'fullName',
  'email',
  'role',
  'isActive',
  'createdAt',
  'updatedAt',
] as const;

export type PublicUser = Omit<User, 'passwordHash'>;

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

  findAll(query: QueryUsersDto): Promise<PublicUser[]> {
    const isActive = query.isActive ?? true;

    return this.usersRepository.find({
      where: { isActive },
      select: [...PUBLIC_USER_FIELDS],
      order: { createdAt: 'DESC' },
    });
  }

  // Per docs/PROJECT_ROADMAP.md Phase 8 — the human confirmed self-registration
  // stays out of scope; only an admin creates collector/admin accounts here.
  async create(dto: CreateUserDto): Promise<PublicUser> {
    await this.assertEmailIsUnique(dto.email);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = this.usersRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      passwordHash,
      role: dto.role,
      isActive: true,
    });

    let saved: User;
    try {
      saved = await this.usersRepository.save(user);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }

    return this.toPublicUser(saved);
  }

  // Deactivating locks the account out of login (see AuthService.login),
  // without deleting it — history (e.g. who sent which reminder) stays intact.
  async deactivate(id: string, currentUserId: string): Promise<PublicUser> {
    if (id === currentUserId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    return this.setActive(id, false);
  }

  async reactivate(id: string): Promise<PublicUser> {
    return this.setActive(id, true);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update({ id }, { passwordHash });
  }

  private async setActive(id: string, isActive: boolean): Promise<PublicUser> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    user.isActive = isActive;
    const saved = await this.usersRepository.save(user);
    return this.toPublicUser(saved);
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }

  private async assertEmailIsUnique(email: string): Promise<void> {
    const existing = await this.usersRepository.findOneBy({ email });
    if (existing) {
      throw new ConflictException(`A user with email ${email} already exists`);
    }
  }

  private mapUniqueViolation(error: unknown): unknown {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === POSTGRES_UNIQUE_VIOLATION
    ) {
      return new ConflictException('A user with this email already exists');
    }
    return error;
  }
}
