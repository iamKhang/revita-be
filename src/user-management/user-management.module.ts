import { Module } from '@nestjs/common';
import { AdminController } from './admin/admin.controller';
import { ClinicAdminModule } from './clinic-admin/clinic-admin.module';
import { ReceptionistModule } from './receptionist/receptionist.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { UserService } from './user.service';
import { PrismaClient } from '@prisma/client';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UserController } from './user.controller';

@Module({
  imports: [
    ClinicAdminModule,
    ReceptionistModule,
    DoctorModule,
    PatientModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AdminController, UserController],
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
