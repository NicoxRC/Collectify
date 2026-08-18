import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class UpdateMessageAudienceDto {
  @ApiProperty({
    type: [String],
    description: "Client ids that make up this template's curated audience.",
  })
  @IsArray()
  @IsUUID('4', { each: true })
  clientIds!: string[];
}
