import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientsModule } from '../clients/clients.module';
import { Client } from '../clients/entities/client.entity';
import { InterestConceptType } from '../interestConceptTypes/entities/interestConceptType.entity';
import { LoansModule } from '../loans/loans.module';

import { ClientLoanImportController } from './clientLoanImport.controller';
import { ClientLoanImportService } from './clientLoanImport.service';

// Depends on both ClientsModule and LoansModule, one-directionally — this
// module is never imported by either of them, so it can sit "above" both
// without creating the cycle that would result from ClientsModule trying
// to import LoansModule directly (LoansModule already imports
// ClientsModule, since LoansService needs ClientsService for the
// mora/cupo guard — see loans.module.ts).
@Module({
  imports: [
    TypeOrmModule.forFeature([Client, InterestConceptType]),
    ClientsModule,
    LoansModule,
  ],
  controllers: [ClientLoanImportController],
  providers: [ClientLoanImportService],
})
export class ClientLoanImportModule {}
