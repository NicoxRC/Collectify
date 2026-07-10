import { DataSourceOptions } from 'typeorm';

import { SnakeNamingStrategy } from './snakeNaming.strategy';

import type { DatabaseConfig } from '../config/configuration';

export function buildDataSourceOptions(
  database: DatabaseConfig,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.user,
    password: database.password,
    database: database.name,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    namingStrategy: new SnakeNamingStrategy(),
    // Never true — schema changes go through migrations only, see docs/DATABASE.md
    synchronize: false,
  };
}
