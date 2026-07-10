import 'dotenv/config';

import * as bcrypt from 'bcrypt';

import { User, UserRole } from '../users/entities/user.entity';

import { AppDataSource } from './dataSource';

const BCRYPT_SALT_ROUNDS = 10;

// One-off CLI utility to create the first admin account, per Phase 2's
// Definition of Done — there's no self-registration in this system.
// Usage: npm run seed:admin -- "Full Name" admin@example.com "a-strong-password"
async function seedAdmin() {
  const [fullName, email, password] = process.argv.slice(2);
  if (!fullName || !email || !password) {
    console.error(
      'Usage: npm run seed:admin -- "Full Name" admin@example.com "a-strong-password"',
    );
    process.exit(1);
  }

  await AppDataSource.initialize();

  const usersRepository = AppDataSource.getRepository(User);
  const existing = await usersRepository.findOneBy({ email });
  if (existing) {
    console.error(`A user with email ${email} already exists.`);
    await AppDataSource.destroy();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const admin = usersRepository.create({
    fullName,
    email,
    passwordHash,
    role: UserRole.Admin,
    isActive: true,
  });
  await usersRepository.save(admin);

  console.log(`Admin user created: ${email}`);
  await AppDataSource.destroy();
}

void seedAdmin();
