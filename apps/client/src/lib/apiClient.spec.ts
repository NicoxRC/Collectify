import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@/lib/apiClient';

function mockFetchOnce(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(body),
    }),
  );
}

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns data and meta when the API responds with the success envelope', async () => {
    mockFetchOnce({
      success: true,
      data: { status: 'ok' },
      meta: { page: 1 },
    });

    const result = await apiClient.get<{ status: string }>('/health');

    expect(result.data).toEqual({ status: 'ok' });
    expect(result.meta).toEqual({ page: 1 });
  });

  it('throws an ApiError when the API responds with the error envelope', async () => {
    mockFetchOnce({
      success: false,
      message: 'Client not found',
      statusCode: 404,
    });

    await expect(apiClient.get('/clients/unknown')).rejects.toThrow(ApiError);
  });
});
