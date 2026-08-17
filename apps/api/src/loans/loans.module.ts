import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientsModule } from '../clients/clients.module';
import { InterestConceptTypesModule } from '../interestConceptTypes/interestConceptTypes.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

import { Installment } from './entities/installment.entity';
import { Loan } from './entities/loan.entity';
import { LoanInstallmentConcept } from './entities/loanInstallmentConcept.entity';
import { Payment } from './entities/payment.entity';
import { InstallmentsController } from './installments/installments.controller';
import { InstallmentsService } from './installments/installments.service';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Loan,
      Installment,
      Payment,
      LoanInstallmentConcept,
    ]),
    WhatsappModule,
    InterestConceptTypesModule,
    ClientsModule,
  ],
  controllers: [LoansController, InstallmentsController],
  providers: [LoansService, InstallmentsService],
  exports: [LoansService, InstallmentsService],
})
export class LoansModule {}
