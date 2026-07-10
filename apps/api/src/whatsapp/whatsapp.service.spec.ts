import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let configService: { get: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    configService = { get: jest.fn() };
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
  });

  it('skips the send and returns false when credentials are not configured', async () => {
    configService.get.mockReturnValue({ phoneNumberId: '', accessToken: '' });

    const result = await service.sendTextMessage('+573001234567', 'hello');

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the message and returns true when the API responds ok', async () => {
    configService.get.mockReturnValue({
      phoneNumberId: 'phone-id',
      accessToken: 'token',
    });
    fetchMock.mockResolvedValue({ ok: true });

    const result = await service.sendTextMessage('+573001234567', 'hello');

    expect(result).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/phone-id/messages');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token' });
  });

  it('returns false when the API responds with a non-ok status', async () => {
    configService.get.mockReturnValue({
      phoneNumberId: 'phone-id',
      accessToken: 'token',
    });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Invalid phone number'),
    });

    const result = await service.sendTextMessage('+573001234567', 'hello');

    expect(result).toBe(false);
  });

  it('returns false when the request throws', async () => {
    configService.get.mockReturnValue({
      phoneNumberId: 'phone-id',
      accessToken: 'token',
    });
    fetchMock.mockRejectedValue(new Error('network error'));

    const result = await service.sendTextMessage('+573001234567', 'hello');

    expect(result).toBe(false);
  });
});
