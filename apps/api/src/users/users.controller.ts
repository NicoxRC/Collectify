import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Audit } from '../auditLog/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

import { CreateUserDto } from './dto/createUser.dto';
import { QueryUsersDto } from './dto/queryUsers.dto';
import { UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

import type { AuthenticatedUser } from '../auth/interfaces/authenticatedUser.interface';
import type { PublicUser } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: 'List users, active by default (admin only)',
    description: 'Pass isActive=false to list deactivated accounts.',
  })
  @ApiResponse({ status: 200, description: 'Returns the list of users.' })
  @ApiResponse({ status: 403, description: 'Requires the admin role.' })
  findAll(@Query() query: QueryUsersDto): Promise<PublicUser[]> {
    return this.usersService.findAll(query);
  }

  @Post()
  @Roles(UserRole.Admin)
  @Audit('user.create', 'user')
  @ApiOperation({
    summary: 'Create a collector or admin account (admin only)',
    description: 'No self-registration — accounts are always admin-created.',
  })
  @ApiResponse({ status: 201, description: 'The user was created.' })
  @ApiResponse({ status: 409, description: 'Email already in use.' })
  create(@Body() dto: CreateUserDto): Promise<PublicUser> {
    return this.usersService.create(dto);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.Admin)
  @Audit('user.deactivate', 'user')
  @ApiOperation({
    summary: 'Deactivate a user account (admin only)',
    description:
      'Locks the account out of login without deleting it. An admin cannot deactivate their own account.',
  })
  @ApiResponse({ status: 200, description: 'The user was deactivated.' })
  @ApiResponse({
    status: 400,
    description: 'Cannot deactivate your own account.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  deactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PublicUser> {
    return this.usersService.deactivate(id, currentUser.id);
  }

  @Patch(':id/reactivate')
  @Roles(UserRole.Admin)
  @Audit('user.reactivate', 'user')
  @ApiOperation({
    summary: 'Reactivate a deactivated user account (admin only)',
  })
  @ApiResponse({ status: 200, description: 'The user was reactivated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  reactivate(@Param('id') id: string): Promise<PublicUser> {
    return this.usersService.reactivate(id);
  }
}
