import { Module } from '@nestjs/common';
import { MedicalRecordController } from './medical-record.controller';
import { MedicalRecordService } from './medical-record.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageModule } from '../file-storage/file-storage.module';

@Module({
  imports: [FileStorageModule],
  controllers: [MedicalRecordController],
  providers: [MedicalRecordService, PrismaService],
})
export class MedicalRecordModule {}
