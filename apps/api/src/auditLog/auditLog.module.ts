import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from '../clients/entities/client.entity';

import { AuditLogController } from './auditLog.controller';
import { AuditLogInterceptor } from './auditLog.interceptor';
import { AuditLogService } from './auditLog.service';
import { AuditLog } from './entities/auditLog.entity';

@Module({
  // Client is registered here (not by importing ClientsModule) purely so
  // AuditLogInterceptor can read a client's name for the
  // addReference/updateReference/removeReference label fallback — see
  // that interceptor's constructor comment. A plain repository, not the
  // module, to avoid pulling in ClientsModule's own dependencies for a
  // single read-only lookup.
  imports: [TypeOrmModule.forFeature([AuditLog, Client])],
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    // Registered globally via the APP_INTERCEPTOR token (not
    // app.useGlobalInterceptors in main.ts, unlike ResponseInterceptor):
    // this interceptor needs constructor-injected dependencies
    // (AuditLogService, Reflector), and useGlobalInterceptors constructs
    // its argument manually with `new`, which can't resolve them.
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
  exports: [AuditLogService],
})
export class AuditLogModule {}
