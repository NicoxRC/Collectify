import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Installment } from '../loans/entities/installment.entity';
import { Loan } from '../loans/entities/loan.entity';

import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { Client } from './entities/client.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Client, Loan, Installment])],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
