import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Client } from '../../clients/entities/client.entity';
import { MessageAudience } from '../entities/messageAudience.entity';
import { MessageType } from '../messageType.enum';
import { MessageTemplatesService } from '../messageTemplates/messageTemplates.service';

// One primary audience per template is the confirmed UI surface (see
// docs/phases/PHASE_18_MESSAGE_AUDIENCES.md) — getForType/upsertForType
// always operate on the single most-recently-created audience for that
// template, creating it on first upsert.
@Injectable()
export class MessageAudiencesService {
  constructor(
    @InjectRepository(MessageAudience)
    private readonly messageAudiencesRepository: Repository<MessageAudience>,
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    private readonly messageTemplatesService: MessageTemplatesService,
  ) {}

  async getForType(type: MessageType): Promise<MessageAudience | null> {
    const template = await this.messageTemplatesService.findByTypeOrThrow(type);
    return this.messageAudiencesRepository.findOne({
      where: { messageTemplateId: template.id },
      relations: ['clients'],
      order: { createdAt: 'DESC' },
    });
  }

  // Used by the cron path (Phase 18) — just the ids, no need to hydrate
  // full Client entities.
  async getClientIdsForTemplateType(type: MessageType): Promise<string[]> {
    const audience = await this.getForType(type);
    return audience ? audience.clients.map((client) => client.id) : [];
  }

  async upsertForType(
    type: MessageType,
    clientIds: string[],
  ): Promise<MessageAudience> {
    const template = await this.messageTemplatesService.findByTypeOrThrow(type);
    const clients = clientIds.length
      ? await this.clientsRepository.findBy({ id: In(clientIds) })
      : [];

    const existing = await this.messageAudiencesRepository.findOne({
      where: { messageTemplateId: template.id },
      order: { createdAt: 'DESC' },
    });

    const audience =
      existing ??
      this.messageAudiencesRepository.create({
        messageTemplateId: template.id,
        name: `${template.name} audience`,
      });
    audience.clients = clients;

    return this.messageAudiencesRepository.save(audience);
  }
}
