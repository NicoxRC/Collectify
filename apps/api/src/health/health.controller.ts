import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';

interface HealthStatus {
  status: 'ok';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Check API liveness' })
  @ApiResponse({ status: 200, description: 'The API is up and running.' })
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
