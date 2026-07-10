import 'dotenv/config';

import { DataSource } from 'typeorm';

import { buildDataSourceOptions } from './typeOrmConfig';

// The TypeORM CLI (migration:generate/run/revert) runs outside the Nest
// application context, so ConfigService isn't available here — this is the
// one place besides config/configuration.ts allowed to read process.env
// directly, per docs/CODING_STANDARDS.md.
export const AppDataSource = new DataSource(
  buildDataSourceOptions({
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    name: process.env.DATABASE_NAME ?? 'collectify',
  }),
);
