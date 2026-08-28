import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RequireModule } from '../auth/decorators/requireModule.decorator';
import { AppModule } from '../users/entities/userModulePermission.entity';

import { CreateInterestConceptTypeDto } from './dto/createInterestConceptType.dto';
import { QueryInterestConceptTypesDto } from './dto/queryInterestConceptTypes.dto';
import { UpdateInterestConceptTypeDto } from './dto/updateInterestConceptType.dto';
import { InterestConceptType } from './entities/interestConceptType.entity';
import { InterestConceptTypesService } from './interestConceptTypes.service';

@ApiTags('interest-concept-types')
@ApiBearerAuth()
@Controller('interest-concept-types')
export class InterestConceptTypesController {
  constructor(
    private readonly interestConceptTypesService: InterestConceptTypesService,
  ) {}

  // Deliberately open to any authenticated user (no @Roles/@RequireModule)
  // — reading the catalog to populate the loan-creation concept picker is
  // needed by every collector who can create a loan, not just an admin or
  // someone specifically granted interest_concept_types. Managing the
  // catalog (create/update/deactivate below) stays restricted. See
  // docs/phases/PHASE_23_DYNAMIC_CHARGES.md "Permissions".
  @Get()
  @ApiOperation({
    summary: 'List interest concept types, active by default',
    description:
      'Pass isActive=false to list deactivated types. Used to populate the concept picker at loan creation — open to any authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Returns the list of types.' })
  findAll(
    @Query() query: QueryInterestConceptTypesDto,
  ): Promise<InterestConceptType[]> {
    return this.interestConceptTypesService.findAll(query);
  }

  @Post()
  @RequireModule(AppModule.InterestConceptTypes)
  @ApiOperation({
    summary:
      'Create a new interest concept type (admin or granted the interest_concept_types module)',
    description:
      'Lets the admin add a new kind of interest/fee concept at any time, without a code change.',
  })
  @ApiResponse({ status: 201, description: 'The concept type was created.' })
  create(
    @Body() dto: CreateInterestConceptTypeDto,
  ): Promise<InterestConceptType> {
    return this.interestConceptTypesService.create(dto);
  }

  @Patch(':id')
  @RequireModule(AppModule.InterestConceptTypes)
  @ApiOperation({
    summary:
      'Update an interest concept type (admin or granted the interest_concept_types module)',
    description:
      'Loans already using this type keep the name/value they were generated with — this only affects the catalog definition for future loans.',
  })
  @ApiResponse({ status: 200, description: 'The concept type was updated.' })
  @ApiResponse({ status: 404, description: 'Concept type not found.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInterestConceptTypeDto,
  ): Promise<InterestConceptType> {
    return this.interestConceptTypesService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @RequireModule(AppModule.InterestConceptTypes)
  @ApiOperation({
    summary:
      'Deactivate an interest concept type (admin or granted the interest_concept_types module)',
    description:
      'Removes it from the picker for new loans. Existing loans that already used it are unaffected.',
  })
  @ApiResponse({
    status: 200,
    description: 'The concept type was deactivated.',
  })
  @ApiResponse({ status: 404, description: 'Concept type not found.' })
  deactivate(@Param('id') id: string): Promise<InterestConceptType> {
    return this.interestConceptTypesService.deactivate(id);
  }
}
