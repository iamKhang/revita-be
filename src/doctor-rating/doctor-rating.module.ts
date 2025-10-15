import { Module } from '@nestjs/common';
import { DoctorRatingService } from './doctor-rating.service';
import { DoctorRatingController } from './doctor-rating.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DoctorRatingController],
  providers: [DoctorRatingService],
  exports: [DoctorRatingService],
})
export class DoctorRatingModule {}
