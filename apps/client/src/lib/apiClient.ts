/**
 * Base fetch wrapper for talking to the API. Parses the two response shapes
 * documented in docs/ARCHITECTURE.md:
 *   success: { success: true, data, meta? }
 *   error:   { success: false, message, statusCode }
 *
 * Convention: apiClient returns the full envelope ({ data, meta }) since
 * `meta` matters for paginated list endpoints. A feature's own `*Api.ts`
 * decides whether to expose `meta` (list endpoints) or unwrap straight to
 * `.data` (single-resource endpoints) — see features/health/healthApi.ts
 * for the unwrapped pattern.
 */

const API_URL = import.meta.env.VITE_API_URL;

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiErrorResponse {
  success: false;
  message: string;
  statusCode: number;
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ApiResult<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = new URL(`${API_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body, params } = options;

  // TODO(Phase 2): attach the Authorization header here once auth exists.
  const response = await fetch(buildUrl(path, params), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.success) {
    throw new ApiError(payload.message, payload.statusCode);
  }

  return { data: payload.data, meta: payload.meta };
}

export const apiClient = {
  get: <T>(path: string, params?: RequestOptions['params']) =>
    request<T>(path, { method: 'GET', params }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
