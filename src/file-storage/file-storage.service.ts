/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UploadFileResponseDto,
  GetFileUrlResponseDto,
} from './dto/upload-file.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileStorageService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(FileStorageService.name);
  private readonly bucketName = 'results';

  constructor() {
    this.supabase = createClient(
      'https://djjeccafahozffgadysws.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqamVjYWZhaG96ZmZnYWR5aXdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDUzNzI1MCwiZXhwIjoyMDcwMTEzMjUwfQ.A844p4XBXejlHzfHOveQlugBOp7Q81muYT6N-tGQeZA',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = '',
  ): Promise<UploadFileResponseDto> {
    try {
      this.logger.log(`Uploading file: ${file.originalname}`);

      // Tạo tên file unique để tránh trùng lặp
      const fileExtension = file.originalname.split('.').pop();
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const filePath = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

      // Upload file lên Supabase Storage
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        this.logger.error(`Upload failed: ${error.message}`);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Lấy public URL của file
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      const response: UploadFileResponseDto = {
        url: urlData.publicUrl,
        originalName: file.originalname,
        fileName: uniqueFileName,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
      };

      this.logger.log(`File uploaded successfully: ${uniqueFileName}`);
      return response;
    } catch (error) {
      this.logger.error(`Upload error: ${error.message}`);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getFileUrl(
    fileName: string,
    folder?: string,
  ): Promise<GetFileUrlResponseDto> {
    try {
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { data } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      const response: GetFileUrlResponseDto = {
        url: data.publicUrl,
        fileName: fileName,
      };

      return response;
    } catch (error) {
      this.logger.error(`Get file URL error: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(fileName: string, folder?: string): Promise<boolean> {
    try {
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        this.logger.error(`Delete file failed: ${error.message}`);
        throw new Error(`Delete failed: ${error.message}`);
      }

      this.logger.log(`File deleted successfully: ${fileName}`);
      return true;
    } catch (error) {
      this.logger.error(`Delete file error: ${error.message}`);
      throw error;
    }
  }

  async listFiles(folder?: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(folder, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) {
        this.logger.error(`List files failed: ${error.message}`);
        throw new Error(`List files failed: ${error.message}`);
      }

      return data?.map((file) => file.name) || [];
    } catch (error) {
      this.logger.error(`List files error: ${error.message}`);
      throw error;
    }
  }
}
