import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Configuration } from '../config/configuration';

const META_GRAPH_API_VERSION = 'v21.0';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  // Returns whether the message was actually sent. Never throws — a failed
  // or skipped send is a business outcome (logged in MessageLog), not an
  // application error.
  async sendTextMessage(
    phoneNumber: string,
    message: string,
  ): Promise<boolean> {
    const { phoneNumberId, accessToken } = this.configService.get('whatsapp', {
      infer: true,
    });

    if (!phoneNumberId || !accessToken) {
      this.logger.warn(
        `WhatsApp credentials are not configured — skipping send to ${phoneNumber}. ` +
          'See docs/ENVIRONMENT_VARIABLES.md.',
      );
      return false;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: { body: message },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `WhatsApp API responded with ${response.status} for ${phoneNumber}: ${errorBody}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message to ${phoneNumber}`,
        error,
      );
      return false;
    }
  }
}
