import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

// Only interest_rate, description, and the co-debtor fields (Phase 21,
// updated to a client link in Phase 26) are editable post-creation.
// interest_rate is confirmed manually editable per docs/DATABASE.md.
// description and the co-debtor fields are plain metadata with no
// cascading effects. Other fields (principal, schedule) would have
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

  // --- Optional co-debtor (codeudor), Phase 26 — at most one per loan, an
  // existing Client picked by id. Must not be the same client as this
  // loan's own client — enforced in LoansService. See
  // docs/phases/PHASE_26_CODEBTOR_CLIENT.md. ---

  @ApiPropertyOptional({
    description: "An existing client's id, picked as this loan's co-debtor.",
  })
  @IsOptional()
  @IsUUID()
  coDebtorClientId?: string;

  @ApiPropertyOptional({ example: 'Hermano del deudor' })
  @IsOptional()
  @IsString()
  coDebtorRelationship?: string;
}
