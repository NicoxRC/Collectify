import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { MessageTemplateType } from '../../entities/messageTemplate.entity';

export class CreateMessageTemplateDto {
  @ApiProperty({ example: 'Weekly overdue reminder' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    enum: MessageTemplateType,
    example: MessageTemplateType.Overdue,
    description:
      'Which message flow this template renders — only one template per type can be active at a time.',
  })
  @IsEnum(MessageTemplateType)
  type!: MessageTemplateType;

  @ApiProperty({
    example:
      'Hola {{clientFullName}}, tienes cuotas vencidas:\n{{installmentsList}}\nEl valor a pagar hoy es ${{grandTotal}}',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
