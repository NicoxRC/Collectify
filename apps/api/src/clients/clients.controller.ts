import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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

import { Roles } from '../auth/decorators/roles.decorator';
import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';
import { UserRole } from '../users/entities/user.entity';

import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/createClient.dto';
import { QueryClientsDto } from './dto/queryClients.dto';
import { UpdateClientDto } from './dto/updateClient.dto';
import { Client } from './entities/client.entity';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'List clients (paginated, searchable, filterable)' })
  @ApiResponse({ status: 200, description: 'Returns a page of clients.' })
  findAll(@Query() query: QueryClientsDto): Promise<PaginatedResult<Client>> {
    return this.clientsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a client by id' })
  @ApiResponse({ status: 200, description: 'Returns the client.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  findOne(@Param('id') id: string): Promise<Client> {
    return this.clientsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Create a client (admin only)' })
  @ApiResponse({ status: 201, description: 'The client was created.' })
  @ApiResponse({ status: 409, description: 'Document number already in use.' })
  create(@Body() dto: CreateClientDto): Promise<Client> {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Update a client (admin only)' })
  @ApiResponse({ status: 200, description: 'The client was updated.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  @ApiResponse({ status: 409, description: 'Document number already in use.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<Client> {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a client (admin only)' })
  @ApiResponse({ status: 204, description: 'The client was deleted.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.clientsService.softDelete(id);
  }
}
