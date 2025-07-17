import { Module } from '@nestjs/common';
import { MedicalRecordController } from './medical-record.controller';
import { MedicalRecordService } from './medical-record.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MedicalRecordController],
  providers: [MedicalRecordService, PrismaService],
})
export class MedicalRecordModule {}
