import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';
import { UserRole } from '../users/entities/user.entity';

import { AuditLogService } from './auditLog.service';
import { QueryAuditLogDto } from './dto/queryAuditLog.dto';
import { AuditLog } from './entities/auditLog.entity';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: 'List audit log entries (paginated, filterable, admin only)',
    description:
      'Filters: actorUserId, action (exact match, e.g. "client.create"), ' +
      'entityType (exact match), dateFrom/dateTo (createdAt range). ' +
      'Ordered newest first. Each entry includes the actor user (name/email), ' +
      'not just their id.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a page of audit log entries.',
  })
  @ApiResponse({ status: 403, description: 'Requires the admin role.' })
  findAll(
    @Query() query: QueryAuditLogDto,
  ): Promise<PaginatedResult<AuditLog>> {
    return this.auditLogService.findAll(query);
  }
}
