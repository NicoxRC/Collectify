import { PartialType } from '@nestjs/swagger';

import { CreateClientReferenceDto } from './createClientReference.dto';

export class UpdateClientReferenceDto extends PartialType(
  CreateClientReferenceDto,
) {}
