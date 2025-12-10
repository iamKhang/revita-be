import { Module } from '@nestjs/common';
import { AppointmentBookingController } from './appointment-booking.controller';
import { AppointmentBookingService } from './appointment-booking.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [AppointmentBookingController],
  providers: [AppointmentBookingService],
  exports: [AppointmentBookingService],
})
export class AppointmentBookingModule {}
