import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Installment } from './entities/installment.entity';
import { Loan } from './entities/loan.entity';
import { Payment } from './entities/payment.entity';
import { InstallmentsController } from './installments/installments.controller';
import { InstallmentsService } from './installments/installments.service';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, Installment, Payment])],
  controllers: [LoansController, InstallmentsController],
  providers: [LoansService, InstallmentsService],
  exports: [LoansService, InstallmentsService],
})
export class LoansModule {}
