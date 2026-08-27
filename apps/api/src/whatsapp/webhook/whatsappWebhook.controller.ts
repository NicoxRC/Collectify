import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Public } from '../../auth/decorators/public.decorator';

import { WhatsappWebhookService } from './whatsappWebhook.service';

@ApiTags('whatsapp')
@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
  constructor(
    private readonly whatsappWebhookService: WhatsappWebhookService,
  ) {}

  // The one deliberate @Public() exception in this module — Meta calls
  // this endpoint directly, with no JWT of ours to send. Its only defenses
  // are the hub.verify_token handshake (this endpoint) and the
  // X-Hub-Signature-256 check (the POST endpoint below). See
  // docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md.
  @Public()
  @Get()
  @ApiOperation({
    summary: "Meta's webhook verification handshake (public, unauthenticated)",
    description:
      'Echoes back hub.challenge as plain text when hub.verify_token matches META_WHATSAPP_WEBHOOK_VERIFY_TOKEN. Response is sent raw (not the usual {success,data} envelope) — Meta requires the bare challenge value.',
  })
  @ApiResponse({
    status: 200,
    description: 'hub.challenge echoed back as plain text.',
  })
  @ApiResponse({ status: 403, description: 'hub.verify_token does not match.' })
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    const verifiedChallenge = this.whatsappWebhookService.verifyHandshake(
      mode,
      token,
      challenge,
    );
    res.status(HttpStatus.OK).send(verifiedChallenge);
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receives inbound WhatsApp events (public, signature-verified)',
    description:
      'Verifies X-Hub-Signature-256 against META_WHATSAPP_APP_SECRET before touching the payload. Every event (button tap or free text, known client or not) is durably logged — a malformed payload is logged and acknowledged, never an unhandled error back to Meta.',
  })
  @ApiResponse({ status: 200, description: 'Acknowledged.' })
  @ApiResponse({
    status: 403,
    description: 'Missing or invalid X-Hub-Signature-256.',
  })
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ): Promise<{ received: true }> {
    this.whatsappWebhookService.verifySignatureOrThrow(req.rawBody, signature);
    await this.whatsappWebhookService.handleIncomingPayload(req.body);
    return { received: true };
  }
}
