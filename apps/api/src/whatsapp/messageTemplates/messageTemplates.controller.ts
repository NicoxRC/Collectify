import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { MessageTemplate } from '../entities/messageTemplate.entity';

import { CreateMessageTemplateDto } from './dto/createMessageTemplate.dto';
import { UpdateMessageTemplateDto } from './dto/updateMessageTemplate.dto';
import { MessageTemplatesService } from './messageTemplates.service';

@ApiTags('message-templates')
@ApiBearerAuth()
@Roles(UserRole.Admin)
@Controller('message-templates')
export class MessageTemplatesController {
  constructor(
    private readonly messageTemplatesService: MessageTemplatesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List message templates (admin only)' })
  @ApiResponse({ status: 200, description: 'Returns every message template.' })
  findAll(): Promise<MessageTemplate[]> {
    return this.messageTemplatesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a message template (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'The template was created, inactive by default.',
  })
  create(@Body() dto: CreateMessageTemplateDto): Promise<MessageTemplate> {
    return this.messageTemplatesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Edit a template's name/content (admin only)" })
  @ApiResponse({ status: 200, description: 'The template was updated.' })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMessageTemplateDto,
  ): Promise<MessageTemplate> {
    return this.messageTemplatesService.update(id, dto);
  }

  @Post(':id/activate')
  @ApiOperation({
    summary: 'Activate a template (admin only)',
    description:
      'Deactivates every other template — only one can be active at a time.',
  })
  @ApiResponse({ status: 200, description: 'The template is now active.' })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  activate(@Param('id') id: string): Promise<MessageTemplate> {
    return this.messageTemplatesService.activate(id);
  }
}
