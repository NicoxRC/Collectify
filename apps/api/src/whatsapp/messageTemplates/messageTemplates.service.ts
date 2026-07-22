import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MessageTemplate } from '../entities/messageTemplate.entity';
import { MessageType } from '../messageType.enum';

// Read-only by design — content is fixed per type, see
// MessageTemplate's entity comment and docs/DATABASE.md "Changed after
// Phase 9". Updating a template's content is a migration, not a service
// method.
@Injectable()
export class MessageTemplatesService {
  constructor(
    @InjectRepository(MessageTemplate)
    private readonly messageTemplatesRepository: Repository<MessageTemplate>,
  ) {}

  findAll(): Promise<MessageTemplate[]> {
    return this.messageTemplatesRepository.find({ order: { type: 'ASC' } });
  }

  async findByTypeOrThrow(type: MessageType): Promise<MessageTemplate> {
    const template = await this.messageTemplatesRepository.findOneBy({
      type,
    });
    if (!template) {
      throw new NotFoundException(
        `No message template is configured for type '${type}'`,
      );
    }
    return template;
  }
}
