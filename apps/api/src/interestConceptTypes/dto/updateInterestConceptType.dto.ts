import { PartialType } from '@nestjs/swagger';

import { CreateInterestConceptTypeDto } from './createInterestConceptType.dto';

export class UpdateInterestConceptTypeDto extends PartialType(
  CreateInterestConceptTypeDto,
) {}
