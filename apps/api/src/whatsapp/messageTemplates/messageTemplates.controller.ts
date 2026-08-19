import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RequireModule } from '../../auth/decorators/requireModule.decorator';
import { AppModule } from '../../users/entities/userModulePermission.entity';
import { MessageAudience } from '../entities/messageAudience.entity';
import { MessageTemplate } from '../entities/messageTemplate.entity';
import { MessageAudiencesService } from '../messageAudiences/messageAudiences.service';
import { MessageType } from '../messageType.enum';

import { UpdateMessageAudienceDto } from './dto/updateMessageAudience.dto';
import { MessageTemplatesService } from './messageTemplates.service';

// Templates themselves are read-only by design — see MessageTemplatesService.
// The curated audience attached to each template (Phase 18) is editable.
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
    private readonly messageAudiencesService: MessageAudiencesService,
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

  @Get(':type/audience')
  @ApiOperation({
    summary:
      "View a message type's curated audience (admin or granted the message_templates module)",
    description:
      'Returns the curated client group attached to this template, or null if none has been set yet.',
  })
  @ApiResponse({
    status: 200,
    description: "Returns the template's curated audience, or null.",
  })
  getAudience(
    @Param('type', new ParseEnumPipe(MessageType)) type: MessageType,
  ): Promise<MessageAudience | null> {
    return this.messageAudiencesService.getForType(type);
  }

  @Put(':type/audience')
  @ApiOperation({
    summary:
      "Replace a message type's curated audience (admin or granted the message_templates module)",
    description:
      "Sets the full list of clients in this template's curated audience, replacing whatever was there before.",
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the updated audience.',
  })
  setAudience(
    @Param('type', new ParseEnumPipe(MessageType)) type: MessageType,
    @Body() dto: UpdateMessageAudienceDto,
  ): Promise<MessageAudience> {
    return this.messageAudiencesService.upsertForType(type, dto.clientIds);
  }
}
