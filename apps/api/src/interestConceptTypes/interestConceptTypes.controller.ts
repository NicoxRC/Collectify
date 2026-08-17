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

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

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

  @Get()
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: 'List interest concept types, active by default (admin only)',
    description:
      'Pass isActive=false to list deactivated types. Used to populate the concept picker at loan creation.',
  })
  @ApiResponse({ status: 200, description: 'Returns the list of types.' })
  findAll(
    @Query() query: QueryInterestConceptTypesDto,
  ): Promise<InterestConceptType[]> {
    return this.interestConceptTypesService.findAll(query);
  }

  @Post()
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: 'Create a new interest concept type (admin only)',
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
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: 'Update an interest concept type (admin only)',
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
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: 'Deactivate an interest concept type (admin only)',
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
