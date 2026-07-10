import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import configuration, { Configuration } from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { buildDataSourceOptions } from './database/typeOrmConfig';
import { HealthModule } from './health/health.module';
import { LoansModule } from './loans/loans.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) =>
        buildDataSourceOptions(configService.get('database', { infer: true })),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    ClientsModule,
    LoansModule,
  ],
})
export class AppModule {}
