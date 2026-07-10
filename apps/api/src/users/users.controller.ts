import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';

import { User, UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'List active users (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns the list of active users.',
  })
  @ApiResponse({ status: 403, description: 'Requires the admin role.' })
  findAllActive(): Promise<Omit<User, 'passwordHash'>[]> {
    return this.usersService.findAllActive();
  }
}
