import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RequireModule } from '../../auth/decorators/requireModule.decorator';
import { AppModule } from '../../users/entities/userModulePermission.entity';
import { MessageTemplate } from '../entities/messageTemplate.entity';

import { MessageTemplatesService } from './messageTemplates.service';

// Templates themselves are read-only by design — see MessageTemplatesService.
//
// The curated audience concept once editable here (Phase 18) is retired as
// of Phase 27: `overdue`/`upcoming_due` no longer filter by audience at
// all (every dynamically-qualifying client is messaged again, throttled
// only by the new per-client frequency whitelist — see
// docs/phases/PHASE_27_MESSAGE_FREQUENCY.md), and `account_summary`/
// `new_loan` never used the audience concept in the first place (see
// docs/phases/PHASE_18_MESSAGE_AUDIENCES.md "Extended further, same
// day"). GET/PUT :type/audience were removed entirely rather than kept as
// a no-op — the underlying message_audiences/message_audience_clients
// tables are NOT dropped (may still hold historical meaning), just no
// longer read by any service.
//
// First controller migrated to the Phase 20 module-permissions system (see
// docs/phases/PHASE_20_MODULE_PERMISSIONS.md) — an admin still has full
// access unconditionally (ModulePermissionsGuard), and a collector now
// needs an explicit grant for AppModule.MessageTemplates instead of being
// unconditionally blocked by role. Every other controller in the system
// still uses @Roles(UserRole.Admin)/@Roles() as before; this migration is
// deliberately incremental, one controller at a time.
@ApiTags('message-templates')
@ApiBearerAuth()
@RequireModule(AppModule.MessageTemplates)
@Controller('message-templates')
export class MessageTemplatesController {
  constructor(
    private readonly messageTemplatesService: MessageTemplatesService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'View the current message templates (admin or granted the message_templates module)',
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
