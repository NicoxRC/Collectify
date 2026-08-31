import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

// Phase 27 — no hardcoded default; the admin sets this freely per client.
// Min(1): a value of 0 or less doesn't make sense as "minimum days between
// messages" and would effectively disable throttling by a different route
// than clearing the entry outright (DELETE /clients/:id/message-frequency).
export class SetClientMessageFrequencyDto {
  @ApiProperty({
    example: 7,
    description:
      "Minimum number of days that must pass since this client's last overdue/upcoming_due message before another one is sent.",
  })
  @IsInt()
  @Min(1)
  minimumDaysBetweenMessages!: number;
}
