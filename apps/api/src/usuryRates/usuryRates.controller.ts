import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Audit } from '../auditLog/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

import { CreateUsuryRateDto } from './dto/createUsuryRate.dto';
import { UsuryRate } from './entities/usuryRate.entity';
import { CurrentUsuryRate, UsuryRateService } from './usuryRates.service';

import type { AuthenticatedUser } from '../auth/interfaces/authenticatedUser.interface';

@ApiTags('usury-rates')
@ApiBearerAuth()
@Controller('usury-rates')
export class UsuryRatesController {
  constructor(private readonly usuryRateService: UsuryRateService) {}

  @Get('current')
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: 'Get the current usury ceiling (admin only)',
    description:
      "isStale is true when nobody has entered this calendar month's certified rate yet — not tied to a fixed publication day, since the SFC's own publication date moves around. See docs/phases/PHASE_15_USURY_RATE.md.",
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the latest rate on file, or null if none exists yet.',
  })
  getCurrentRate(): Promise<CurrentUsuryRate | null> {
    return this.usuryRateService.getCurrentRate();
  }

  @Get()
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary:
      'List the full usury rate history, most recent month first (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Returns the rate history.' })
  findAll(): Promise<UsuryRate[]> {
    return this.usuryRateService.findAll();
  }

  @Post()
  @Roles(UserRole.Admin)
  @Audit('usuryRate.create', 'usuryRate')
  @ApiOperation({
    summary: "Record a new month's certified usury rate (admin only)",
    description:
      "Always creates a new historical row — never mutates a previous month's rate. Rejects a duplicate month.",
  })
  @ApiResponse({ status: 201, description: 'The rate was recorded.' })
  @ApiResponse({
    status: 409,
    description: 'A rate for that month already exists.',
  })
  setRate(
    @Body() dto: CreateUsuryRateDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UsuryRate> {
    return this.usuryRateService.setRate(dto, currentUser.id);
  }
}
