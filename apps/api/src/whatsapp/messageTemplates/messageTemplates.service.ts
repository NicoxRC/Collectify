import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MessageTemplate } from '../entities/messageTemplate.entity';

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

  async findActiveOrThrow(): Promise<MessageTemplate> {
    const active = await this.messageTemplatesRepository.findOneBy({
      isActive: true,
    });
    if (!active) {
      throw new NotFoundException('No active message template is configured');
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

  async activate(id: string): Promise<MessageTemplate> {
    await this.findOne(id);

    await this.messageTemplatesRepository.manager.transaction(
      async (manager) => {
        await manager
          .createQueryBuilder()
          .update(MessageTemplate)
          .set({ isActive: false })
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
}
