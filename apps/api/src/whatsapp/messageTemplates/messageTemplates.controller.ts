import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { MessageTemplate } from '../entities/messageTemplate.entity';

import { MessageTemplatesService } from './messageTemplates.service';

// Read-only by design — see MessageTemplatesService.
@ApiTags('message-templates')
@ApiBearerAuth()
@Roles(UserRole.Admin)
@Controller('message-templates')
export class MessageTemplatesController {
  constructor(
    private readonly messageTemplatesService: MessageTemplatesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'View the current message templates (admin only)',
    description:
      'Returns the one template currently in use per message type. Templates are fixed, not editable through this API — see docs/DATABASE.md.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns every message template currently in use.',
  })
  findAll(): Promise<MessageTemplate[]> {
    return this.messageTemplatesService.findAll();
  }
}
