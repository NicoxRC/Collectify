import { PartialType } from '@nestjs/swagger';

import { CreateMessageTemplateDto } from './createMessageTemplate.dto';

// isActive is not editable here — activation is a dedicated operation
// (POST /message-templates/:id/activate) that enforces "only one active
// at a time" at the service level.
export class UpdateMessageTemplateDto extends PartialType(
  CreateMessageTemplateDto,
) {}
