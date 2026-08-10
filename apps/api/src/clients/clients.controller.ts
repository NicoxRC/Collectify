import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Audit } from '../auditLog/decorators/audit.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';
import { UserRole } from '../users/entities/user.entity';

import {
  ClientDetail,
  ClientsService,
  ImportClientsResult,
} from './clients.service';
import { CreateClientDto } from './dto/createClient.dto';
import { QueryClientsDto } from './dto/queryClients.dto';
import { UpdateClientDto } from './dto/updateClient.dto';
import { Client } from './entities/client.entity';

const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

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
  @ApiResponse({
    status: 200,
    description:
      'Returns the client, including creditUsed, creditAvailable and ' +
      'isMoraBlocked — all computed on read, not stored columns. See ' +
      'docs/phases/PHASE_10_CLIENT_CAPACITY.md.',
  })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  findOne(@Param('id') id: string): Promise<ClientDetail> {
    return this.clientsService.findOneDetail(id);
  }

  @Post()
  @Roles(UserRole.Admin)
  @Audit('client.create', 'client')
  @ApiOperation({ summary: 'Create a client (admin only)' })
  @ApiResponse({ status: 201, description: 'The client was created.' })
  @ApiResponse({ status: 409, description: 'Document number already in use.' })
  create(@Body() dto: CreateClientDto): Promise<Client> {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.Admin)
  @Audit('client.update', 'client')
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

  @Patch(':id/reactivate')
  @Roles(UserRole.Admin)
  @Audit('client.reactivate', 'client')
  @ApiOperation({ summary: 'Restore a soft-deleted client (admin only)' })
  @ApiResponse({ status: 200, description: 'The client was reactivated.' })
  @ApiResponse({ status: 400, description: 'The client is already active.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  reactivate(@Param('id') id: string): Promise<Client> {
    return this.clientsService.reactivate(id);
  }

  @Post('import')
  @Roles(UserRole.Admin)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMPORT_FILE_SIZE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Bulk-import clients from an .xlsx file (admin only)',
    description:
      'Accepts Spanish (Nombre/Apellido/Cédula/Teléfono) or English (First Name/Last Name/Document ' +
      'Number/Phone) headers, case- and accent-insensitive. A row with missing/invalid data or a ' +
      'duplicate document number is skipped and reported in the response — it does not abort the rest ' +
      'of the import. Max file size 5MB.',
  })
  @ApiResponse({ status: 201, description: 'Returns the import summary.' })
  @ApiResponse({
    status: 400,
    description:
      'No file uploaded, wrong file type, unreadable file, or missing required column(s).',
  })
  importClients(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ImportClientsResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (file.mimetype !== XLSX_MIME_TYPE) {
      throw new BadRequestException('Only .xlsx files are supported');
    }
    return this.clientsService.importFromExcel(file.buffer);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('client.deactivate', 'client')
  @ApiOperation({ summary: 'Soft-delete a client (admin only)' })
  @ApiResponse({ status: 204, description: 'The client was deleted.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.clientsService.softDelete(id);
  }
}
