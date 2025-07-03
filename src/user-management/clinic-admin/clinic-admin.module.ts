import { Module } from '@nestjs/common';
import { ClinicAdminController } from './clinic-admin.controller';
import { ClinicAdminService } from './clinic-admin.service';

@Module({
  controllers: [ClinicAdminController],
  providers: [ClinicAdminService],
})
export class ClinicAdminModule {}
