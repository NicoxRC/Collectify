import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { MessageType } from '../../messageType.enum';

export class CreateMessageTemplateDto {
  @ApiProperty({ example: 'Weekly overdue reminder' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    enum: MessageType,
    example: MessageType.Overdue,
    description:
      'Which message flow this template renders — only one template per type can be active at a time.',
  })
  @IsEnum(MessageType)
  type!: MessageType;

  @ApiProperty({
    example:
      'Hola {{clientFullName}}, tienes cuotas vencidas:\n{{installmentsList}}\nEl valor a pagar hoy es {{grandTotal}}',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
