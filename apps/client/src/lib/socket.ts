/**
 * Shared Socket.IO connection factory. Lives in lib/ (not features/) for
 * the same reason apiClient.ts does — features/ must not be a dependency
 * of lib/, see docs/ARCHITECTURE.md.
 *
 * VITE_API_URL is the REST base (e.g. "http://localhost:3000/api/v1");
 * Socket.IO connects to the bare origin plus a namespace, not that path,
 * so the "/api/v1" suffix is stripped here.
 */
import { io } from 'socket.io-client';

import { tokenStore } from '@/lib/tokenStore';

import type { Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL as string;
const SOCKET_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

// Auth (Phase 22 gateway): the access token is sent once in the handshake,
// not per-message — WhatsappInboundGateway.handleConnection verifies it by
// hand, since Socket.IO's handshake doesn't go through JwtAuthGuard. A
// stale/expired token at connect time just fails the handshake; there's no
// reconnect-with-refreshed-token flow yet (the socket only needs to survive
// as long as the admin has the inbox open with a valid session).
export function connectNamespace(namespace: string): Socket {
  return io(`${SOCKET_ORIGIN}/${namespace}`, {
    auth: { token: tokenStore.getAccessToken() },
    autoConnect: true,
  });
}
