import { createHmac, timingSafeEqual } from 'crypto';

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Client } from '../../clients/entities/client.entity';
import { Configuration } from '../../config/configuration';
import { WhatsappInboundMessage } from '../entities/whatsappInboundMessage.entity';

import {
  extractInboundEvents,
  ParsedInboundEvent,
} from './extractInboundEvents';
import { normalizeIncomingPhoneNumber } from './normalizeIncomingPhoneNumber';

const HUB_SUBSCRIBE_MODE = 'subscribe';

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    @InjectRepository(WhatsappInboundMessage)
    private readonly inboundMessagesRepository: Repository<WhatsappInboundMessage>,
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
  ) {}

  // Meta's one-time verification handshake — echoes hub.challenge back only
  // when hub.verify_token matches our configured secret. Throws (→ 403) on
  // any mismatch, including an unconfigured token, rather than ever
  // treating a missing secret as "anything goes".
  verifyHandshake(mode: string, token: string, challenge: string): string {
    const { webhookVerifyToken } = this.configService.get('whatsapp', {
      infer: true,
    });

    if (
      mode !== HUB_SUBSCRIBE_MODE ||
      !webhookVerifyToken ||
      token !== webhookVerifyToken
    ) {
      throw new ForbiddenException('Webhook verify token mismatch.');
    }

    return challenge;
  }

  // Must run before the payload is parsed at all, per
  // docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md. Constant-time comparison
  // (timingSafeEqual) so response timing can't leak the correct signature.
  verifySignatureOrThrow(
    rawBody: Buffer | undefined,
    signatureHeader: string | undefined,
  ): void {
    const { appSecret } = this.configService.get('whatsapp', { infer: true });

    if (!appSecret || !signatureHeader || !rawBody) {
      throw new ForbiddenException('Missing WhatsApp webhook signature.');
    }

    const expectedSignature = `sha256=${createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;
    const expected = Buffer.from(expectedSignature);
    const actual = Buffer.from(signatureHeader);

    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new ForbiddenException('Invalid WhatsApp webhook signature.');
    }
  }

  // Never throws — a payload we can't fully parse still gets every event it
  // *can* extract persisted, and acks 200 either way, per the phase's
  // "never lost, never an unhandled error back to Meta" requirement.
  async handleIncomingPayload(payload: unknown): Promise<void> {
    let events: ParsedInboundEvent[] = [];
    try {
      events = extractInboundEvents(payload);
    } catch (error) {
      this.logger.error('Failed to parse an inbound WhatsApp payload', error);
      return;
    }

    for (const event of events) {
      await this.persistEvent(event);
    }
  }

  private async persistEvent(event: ParsedInboundEvent): Promise<void> {
    const client = await this.clientsRepository.findOneBy({
      phoneNumber: normalizeIncomingPhoneNumber(event.fromPhoneNumber),
    });

    const inboundMessage = this.inboundMessagesRepository.create({
      clientId: client?.id ?? null,
      fromPhoneNumber: event.fromPhoneNumber,
      type: event.type,
      buttonPayload: event.buttonPayload,
      bodyText: event.bodyText,
      rawPayload: event.rawPayload,
      receivedAt: event.receivedAt,
    });

    await this.inboundMessagesRepository.save(inboundMessage);
  }
}
