import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLogController } from './auditLog.controller';
import { AuditLogInterceptor } from './auditLog.interceptor';
import { AuditLogService } from './auditLog.service';
import { AuditLog } from './entities/auditLog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
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
