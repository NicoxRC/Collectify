import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InterestConceptType } from './entities/interestConceptType.entity';
import { InterestConceptTypesController } from './interestConceptTypes.controller';
import { InterestConceptTypesService } from './interestConceptTypes.service';

@Module({
  imports: [TypeOrmModule.forFeature([InterestConceptType])],
  controllers: [InterestConceptTypesController],
  providers: [InterestConceptTypesService],
  exports: [InterestConceptTypesService],
})
export class InterestConceptTypesModule {}
