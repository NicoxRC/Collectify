import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

// Applies the same CORS origin as app.enableCors() in main.ts (REST) to
// every WebSocket gateway, instead of hardcoding it per-gateway decorator —
// keeps the one source of truth for "who's allowed to call this API" in
// main.ts, matching this project's existing REST CORS setup.
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly corsOrigin: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigin, credentials: true },
    });
  }
}
