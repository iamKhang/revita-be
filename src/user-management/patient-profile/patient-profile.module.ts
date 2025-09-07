import { Module } from '@nestjs/common';
import { PatientProfileController } from './patient-profile.controller';
import { PatientProfileService } from './patient-profile.service';
import { CodeGeneratorService } from './code-generator.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PatientProfileController],
  providers: [PatientProfileService, CodeGeneratorService],
  exports: [PatientProfileService, CodeGeneratorService],
})
export class PatientProfileModule {}
