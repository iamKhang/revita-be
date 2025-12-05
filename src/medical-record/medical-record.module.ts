import { Module } from '@nestjs/common';
import { MedicalRecordController } from './medical-record.controller';
import { MedicalRecordService } from './medical-record.service';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { TranslationService } from './translation.service';
import { EncryptionService } from './encryption.service';

@Module({
  imports: [FileStorageModule],
  controllers: [MedicalRecordController, TemplateController],
  providers: [
    MedicalRecordService,
    TemplateService,
    PrismaService,
    TranslationService,
    EncryptionService,
  ],
})
export class MedicalRecordModule {}
