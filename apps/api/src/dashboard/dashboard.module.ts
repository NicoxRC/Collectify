import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Installment } from '../loans/entities/installment.entity';
import { Loan } from '../loans/entities/loan.entity';
import { Payment } from '../loans/entities/payment.entity';
import { MessageLog } from '../whatsapp/entities/messageLog.entity';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, Installment, Payment, MessageLog])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
