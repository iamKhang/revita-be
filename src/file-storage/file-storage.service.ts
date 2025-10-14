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
  private readonly allowedBuckets: string[];

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL ?? '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const bucketsEnv = process.env.SUPABASE_BUCKETS ?? '';
    const parsedBuckets = bucketsEnv
      .split(',')
      .map((bucket) => bucket.trim())
      .filter((bucket) => bucket.length > 0);

    this.allowedBuckets = parsedBuckets.length > 0 ? parsedBuckets : ['profiles', 'results'];

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  private ensureBucketAllowed(bucket: string): void {
    if (!this.allowedBuckets.includes(bucket)) {
      throw new Error(
        `Bucket không hợp lệ. Chỉ chấp nhận: ${this.allowedBuckets.join(', ')}`,
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    bucket: string,
    folder: string = '',
  ): Promise<UploadFileResponseDto> {
    try {
      this.ensureBucketAllowed(bucket);
      this.logger.log(`Uploading file: ${file.originalname} to bucket ${bucket}`);

      // Tạo tên file unique để tránh trùng lặp
      const fileExtension = file.originalname.split('.').pop();
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const filePath = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

      // Upload file lên Supabase Storage
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { data, error } = await this.supabase.storage
        .from(bucket)
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
        .from(bucket)
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
    bucket: string,
    fileName: string,
    folder?: string,
  ): Promise<GetFileUrlResponseDto> {
    try {
      this.ensureBucketAllowed(bucket);
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { data } = this.supabase.storage
        .from(bucket)
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

  async deleteFile(
    bucket: string,
    fileName: string,
    folder?: string,
  ): Promise<boolean> {
    try {
      this.ensureBucketAllowed(bucket);
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error } = await this.supabase.storage
        .from(bucket)
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

  async listFiles(bucket: string, folder?: string): Promise<string[]> {
    try {
      this.ensureBucketAllowed(bucket);
      const { data, error } = await this.supabase.storage
        .from(bucket)
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

  async uploadFiles(
    files: Express.Multer.File[],
    bucket: string,
    folder: string = '',
  ): Promise<UploadFileResponseDto[]> {
    const results: UploadFileResponseDto[] = [];
    for (const file of files) {
      // Reuse single upload to keep logic unified
      // eslint-disable-next-line no-await-in-loop
      const uploaded = await this.uploadFile(file, bucket, folder);
      results.push(uploaded);
    }
    return results;
  }

  async deleteFiles(
    bucket: string,
    fileNamesOrPaths: string[],
  ): Promise<{ deleted: string[]; failed: string[] }> {
    this.ensureBucketAllowed(bucket);
    const deleted: string[] = [];
    const failed: string[] = [];
    for (const nameOrPath of fileNamesOrPaths) {
      const filePath = nameOrPath;
      // eslint-disable-next-line no-await-in-loop
      const { error } = await this.supabase.storage.from(bucket).remove([filePath]);
      if (error) {
        failed.push(filePath);
      } else {
        deleted.push(filePath);
      }
    }
    return { deleted, failed };
  }

  parseBucketAndPathFromUrl(url: string): { bucket: string; path: string } | null {
    try {
      // Expect URLs like: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
      const marker = '/storage/v1/object/public/';
      const idx = url.indexOf(marker);
      if (idx === -1) return null;
      const rest = url.substring(idx + marker.length);
      const firstSlash = rest.indexOf('/');
      if (firstSlash === -1) return null;
      const bucket = rest.substring(0, firstSlash);
      const path = rest.substring(firstSlash + 1);
      return { bucket, path };
    } catch {
      return null;
    }
  }

  async deleteByUrls(urls: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];
    for (const url of urls) {
      const parsed = this.parseBucketAndPathFromUrl(url);
      if (!parsed) {
        failed.push(url);
        // continue to next
        // eslint-disable-next-line no-continue
        continue;
      }
      if (!this.allowedBuckets.includes(parsed.bucket)) {
        failed.push(url);
        // eslint-disable-next-line no-continue
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const { error } = await this.supabase.storage
        .from(parsed.bucket)
        .remove([parsed.path]);
      if (error) {
        failed.push(url);
      } else {
        deleted.push(url);
      }
    }
    return { deleted, failed };
  }
}
