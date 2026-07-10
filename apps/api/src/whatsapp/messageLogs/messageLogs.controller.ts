import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { PaginatedResult } from '../../common/interfaces/paginatedResult.interface';
import { MessageLog } from '../entities/messageLog.entity';

import { QueryMessageLogsDto } from './dto/queryMessageLogs.dto';
import { MessageLogsService } from './messageLogs.service';

@ApiTags('message-logs')
@ApiBearerAuth()
@Controller('message-logs')
export class MessageLogsController {
  constructor(private readonly messageLogsService: MessageLogsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List sent reminder messages (paginated, filter by client/date range/status)',
  })
  @ApiResponse({ status: 200, description: 'Returns a page of message logs.' })
  findAll(
    @Query() query: QueryMessageLogsDto,
  ): Promise<PaginatedResult<MessageLog>> {
    return this.messageLogsService.findAll(query);
  }
}
