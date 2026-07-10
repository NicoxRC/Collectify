import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Opts a route out of the global JwtAuthGuard — see guards/jwtAuth.guard.ts
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
