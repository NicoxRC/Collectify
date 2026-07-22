import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MessageTemplate } from '../entities/messageTemplate.entity';
import { MessageType } from '../messageType.enum';

import { CreateMessageTemplateDto } from './dto/createMessageTemplate.dto';
import { UpdateMessageTemplateDto } from './dto/updateMessageTemplate.dto';

@Injectable()
export class MessageTemplatesService {
  constructor(
    @InjectRepository(MessageTemplate)
    private readonly messageTemplatesRepository: Repository<MessageTemplate>,
  ) {}

  findAll(): Promise<MessageTemplate[]> {
    return this.messageTemplatesRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<MessageTemplate> {
    const template = await this.messageTemplatesRepository.findOneBy({ id });
    if (!template) {
      throw new NotFoundException(`Message template with id ${id} not found`);
    }
    return template;
  }

  // Each message flow (new_loan, upcoming_due, overdue, account_summary)
  // has its own active template — see docs/phases/PHASE_9_MESSAGE_TYPES.md.
  async findActiveOrThrow(type: MessageType): Promise<MessageTemplate> {
    const active = await this.messageTemplatesRepository.findOneBy({
      type,
      isActive: true,
    });
    if (!active) {
      throw new NotFoundException(
        `No active message template is configured for type '${type}'`,
      );
    }
    return active;
  }

  create(dto: CreateMessageTemplateDto): Promise<MessageTemplate> {
    const template = this.messageTemplatesRepository.create({
      ...dto,
      isActive: false,
    });
    return this.messageTemplatesRepository.save(template);
  }

  async update(
    id: string,
    dto: UpdateMessageTemplateDto,
  ): Promise<MessageTemplate> {
    const template = await this.findOne(id);
    Object.assign(template, dto);
    return this.messageTemplatesRepository.save(template);
  }

  // "Only one active template" is scoped per type — activating a new_loan
  // template must not deactivate the currently active overdue template.
  async activate(id: string): Promise<MessageTemplate> {
    const target = await this.findOne(id);

    await this.messageTemplatesRepository.manager.transaction(
      async (manager) => {
        await manager
          .createQueryBuilder()
          .update(MessageTemplate)
          .set({ isActive: false })
          .where('type = :type', { type: target.type })
          .execute();
        await manager
          .createQueryBuilder()
          .update(MessageTemplate)
          .set({ isActive: true })
          .where('id = :id', { id })
          .execute();
      },
    );

    return this.findOne(id);
  }

  // Soft delete (the entity already has deletedAt for this). Blocks
  // deleting the currently active template — it's what a scheduled/manual
  // send looks up via findActiveOrThrow, so removing it out from under a
  // live message flow would break the next send with no template to render
  // from. Deactivate/replace it first, or activate a different one.
  async remove(id: string): Promise<void> {
    const template = await this.findOne(id);
    if (template.isActive) {
      throw new BadRequestException(
        `Message template ${id} is active and cannot be deleted — activate a different template first`,
      );
    }
    await this.messageTemplatesRepository.softDelete(id);
  }
}
