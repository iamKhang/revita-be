import { Module } from '@nestjs/common';
import { FileStorageController } from './file-storage.controller';
import { FileStorageService } from './file-storage.service';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';

@Module({
  imports: [
    MulterModule.register({
      storage: multer.memoryStorage(), // Lưu file trong memory thay vì disk
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  ],
  controllers: [FileStorageController],
  providers: [FileStorageService],
  exports: [FileStorageService], // Export service để các module khác có thể sử dụng
})
export class FileStorageModule {}
