import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { Configuration } from '../config/configuration';
import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwtAuth.guard';
import { ModulePermissionsGuard } from './guards/modulePermissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) => ({
        secret: configService.get('jwt', { infer: true }).secret,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Order matters: JwtAuthGuard populates req.user before RolesGuard and
    // ModulePermissionsGuard read it. The latter two are independent — see
    // ModulePermissionsGuard's doc comment for why running both is safe
    // during Phase 20's incremental migration.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ModulePermissionsGuard },
  ],
  // JwtModule exported for WhatsappInboundGateway (WhatsappModule), which
  // verifies a socket connection's access token by hand — Socket.IO's
  // handshake never goes through JwtAuthGuard/Passport. See
  // docs/phasesClient/PHASE_22_WHATSAPP_WEBHOOK.md.
  exports: [JwtModule],
})
export class AuthModule {}
