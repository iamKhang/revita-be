import { Module } from '@nestjs/common';
import { AppointmentBookingController } from './appointment-booking.controller';
import { AppointmentBookingService } from './appointment-booking.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AppointmentBookingController],
  providers: [AppointmentBookingService],
  exports: [AppointmentBookingService],
})
export class AppointmentBookingModule {}
