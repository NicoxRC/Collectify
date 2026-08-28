import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
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

  // The api never handles the upload — each URL must already point to an
  // externally hosted deposit receipt photo (Cloudinary, see
  // docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md). @IsUrl({}, {each: true})
  // rejects anything that isn't a well-formed URL. Phase 28 — a payment can
  // now carry more than one receipt photo ("hay personas que mandan más de
  // un comprobante por cuota"); persisted as payment_images rows, one per
  // URL. Replaces the old singular imageUrl field.
  @ApiPropertyOptional({
    type: [String],
    example: ['https://res.cloudinary.com/demo/image/upload/receipt.jpg'],
    description:
      'URLs of the deposit receipt photos, already uploaded to the external image host. The api does not accept or process image bytes directly.',
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}
