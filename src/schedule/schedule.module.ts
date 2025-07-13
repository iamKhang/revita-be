import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaClient } from '@prisma/client';
import { ScheduleService } from './services/schedule.service';
import { DoctorScheduleController } from './controllers/doctor-schedule.controller';
import { ClinicAdminScheduleController } from './controllers/clinic-admin-schedule.controller';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [DoctorScheduleController, ClinicAdminScheduleController],
  providers: [
    ScheduleService,
    {
      provide: PrismaClient,
      useValue: new PrismaClient(),
    },
  ],
  exports: [ScheduleService],
})
export class ScheduleModule {}
