import { Module } from '@nestjs/common';
import { AdminController } from './admin/admin.controller';
import { ClinicAdminModule } from './clinic-admin/clinic-admin.module';
import { ReceptionistModule } from './receptionist/receptionist.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { UserService } from './user.service';
import { PrismaClient } from '@prisma/client';

@Module({
  imports: [ClinicAdminModule, ReceptionistModule, DoctorModule, PatientModule],
  controllers: [AdminController],
  providers: [
    UserService,
    {
      provide: PrismaClient,
      useValue: new PrismaClient(),
    },
  ],
  exports: [UserService],
})
export class UserManagementModule {}
