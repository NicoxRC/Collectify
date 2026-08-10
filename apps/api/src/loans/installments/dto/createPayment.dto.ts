import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 150000 })
  @IsPositive()
  amountPaid!: number;

  @ApiProperty({ example: '2026-07-09' })
  @IsDateString()
  paidAt!: string;

  @ApiPropertyOptional({ example: 'Pagó en el local' })
  @IsOptional()
  @IsString()
  observation?: string;

  // The api never handles the upload — this must already point to the
  // externally hosted deposit receipt photo (Cloudinary, see
  // docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md). @IsUrl rejects anything
  // that isn't a well-formed URL rather than accepting an arbitrary string.
  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/receipt.jpg',
    description:
      'URL of the deposit receipt photo, already uploaded to the external image host. The api does not accept or process image bytes directly.',
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
