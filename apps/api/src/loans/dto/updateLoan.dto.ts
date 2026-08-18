import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

import { DocumentType } from '../../clients/entities/client.entity';

// Only interest_rate, description, and the co-debtor fields (Phase 21) are
// editable post-creation. interest_rate is confirmed manually editable per
// docs/DATABASE.md. description and the co-debtor fields are plain metadata
// with no cascading effects. Other fields (principal, schedule) would have
// cascading effects on already-generated installments that aren't scoped
// here.
export class UpdateLoanDto {
  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number;

  @ApiPropertyOptional({
    example: 'Compra de Apple MacBook Air M5, 512GB',
  })
  @IsOptional()
  @IsString()
  description?: string;

  // --- Optional co-debtor (codeudor), Phase 21 — at most one per loan,
  // confirmed with the business. See
  // docs/phases/PHASE_21_CLIENT_PROFILE.md. ---

  @ApiPropertyOptional({ example: 'Carlos Gómez' })
  @IsOptional()
  @IsString()
  coDebtorFullName?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  coDebtorDocumentType?: DocumentType;

  @ApiPropertyOptional({ example: '1122334455' })
  @IsOptional()
  @IsString()
  coDebtorDocumentNumber?: string;

  @ApiPropertyOptional({ example: '+573007778899' })
  @IsOptional()
  @IsPhoneNumber('CO')
  coDebtorPhoneNumber?: string;

  @ApiPropertyOptional({ example: 'Cra 10 #20-30' })
  @IsOptional()
  @IsString()
  coDebtorAddress?: string;

  @ApiPropertyOptional({ example: 'Hermano del deudor' })
  @IsOptional()
  @IsString()
  coDebtorRelationship?: string;

  @ApiPropertyOptional({
    description: 'Externally-hosted URL (image or PDF), optional.',
  })
  @IsOptional()
  @IsUrl()
  coDebtorIdDocumentUrl?: string;
}
