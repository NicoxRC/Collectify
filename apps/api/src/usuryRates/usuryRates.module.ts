import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsuryRate } from './entities/usuryRate.entity';
import { UsuryRatesController } from './usuryRates.controller';
import { UsuryRateService } from './usuryRates.service';

@Module({
  imports: [TypeOrmModule.forFeature([UsuryRate])],
  controllers: [UsuryRatesController],
  providers: [UsuryRateService],
  exports: [UsuryRateService],
})
export class UsuryRatesModule {}
