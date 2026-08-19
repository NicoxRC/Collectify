import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Audit } from '../auditLog/decorators/audit.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

import {
  ClientLoanImportResult,
  ClientLoanImportService,
} from './clientLoanImport.service';
import { RowError } from './clientLoanImportParser';

import type { ClientLoanImportMode } from './clientLoanImport.service';
import type { Response } from 'express';

const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const XLSX_RESPONSE_CONTENT_TYPE = XLSX_MIME_TYPE;

class ImportErrorsExportDto {
  errors!: RowError[];
}

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientLoanImportController {
  constructor(private readonly importService: ClientLoanImportService) {}

  @Post('import-template')
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary:
      'Download an empty .xlsx template for the combined clients+loans import (admin only)',
    description:
      'Columns always match what POST /clients/import-with-loans accepts — both are built from the ' +
      'same column definitions, so they cannot drift apart. One row = one credit: a client with ' +
      'several loans appears on several rows with the same cédula.',
  })
  @ApiResponse({ status: 201, description: 'Returns the .xlsx template file.' })
  async downloadTemplate(@Res() res: Response): Promise<void> {
    const buffer = await this.importService.generateTemplate();
    res.set({
      'Content-Type': XLSX_RESPONSE_CONTENT_TYPE,
      'Content-Disposition':
        'attachment; filename="plantilla-clientes-creditos.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import-with-loans')
  @Roles(UserRole.Admin)
  @Audit('clientLoanImport.execute', 'clientLoanImport')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMPORT_FILE_SIZE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'mode',
    enum: ['normal', 'historical'],
    required: false,
    description:
      '"normal" (default) enforces the same mora/cupo guard as creating a loan by hand. ' +
      '"historical" skips that guard, for loading a past loan book where the credit already ' +
      'happened — the promissory-note-uniqueness check and the usury-ceiling warning always run ' +
      'regardless of mode.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Bulk-import clients and their initial loan from an .xlsx file (admin only)',
    description:
      'One row = one credit — the same cédula can repeat across rows for a client with several ' +
      'loans. All-or-nothing per row: if the loan fails, the client from that same row is not left ' +
      'behind either. A row with a cédula that matches an existing client but different data in it ' +
      'is skipped as a conflict, never silently updated. Max file size 5MB.',
  })
  @ApiResponse({ status: 201, description: 'Returns the import summary.' })
  @ApiResponse({
    status: 400,
    description:
      'No file uploaded, wrong file type, unreadable file, or missing required column(s).',
  })
  async importClientsWithLoans(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('mode') mode: ClientLoanImportMode = 'normal',
  ): Promise<ClientLoanImportResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (file.mimetype !== XLSX_MIME_TYPE) {
      throw new BadRequestException('Only .xlsx files are supported');
    }
    if (mode !== 'normal' && mode !== 'historical') {
      throw new BadRequestException('mode must be "normal" or "historical"');
    }
    return this.importService.importFromExcel(file.buffer, mode);
  }

  @Post('import-errors-export')
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary:
      'Regenerate a downloadable .xlsx of just the rows that failed a given import attempt (admin only)',
    description:
      'Stateless — pass back the exact `skipped` array from a prior POST /clients/import-with-loans ' +
      'response. Pre-fills each failed row plus a "Motivo del error" column, using the same columns ' +
      'as the template, so the corrected file can be re-uploaded through the same endpoint.',
  })
  @ApiResponse({ status: 201, description: 'Returns the .xlsx file.' })
  async exportErrors(
    @Body() dto: ImportErrorsExportDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.importService.generateErrorsExport(
      dto.errors ?? [],
    );
    res.set({
      'Content-Type': XLSX_RESPONSE_CONTENT_TYPE,
      'Content-Disposition':
        'attachment; filename="errores-de-importacion.xlsx"',
    });
    res.send(buffer);
  }
}
