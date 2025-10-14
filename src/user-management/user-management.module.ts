import { Module } from '@nestjs/common';
import { AdminController } from './admin/admin.controller';
import { ReceptionistModule } from './receptionist/receptionist.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { PatientProfileModule } from './patient-profile/patient-profile.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { StaffModule } from './staff/staff.module';

import { PrismaClient } from '@prisma/client';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UserController } from './user.controller';

@Module({
  imports: [
    ReceptionistModule,
    DoctorModule,
    PatientModule,
    PatientProfileModule,
    FileStorageModule,
    StaffModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AdminController, UserController],
  providers: [
    {
      provide: PrismaClient,
      useValue: new PrismaClient(),
    },
  ],
  exports: [],
})
export class UserManagementModule {}
