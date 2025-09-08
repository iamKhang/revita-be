import {
  Controller,
  Post,
  Get,
  Delete,
  UploadedFile,
  UploadedFiles,
  Query,
  UseInterceptors,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FileStorageService } from './file-storage.service';
import {
  UploadFileResponseDto,
  GetFileUrlResponseDto,
} from './dto/upload-file.dto';

@ApiTags('File Storage')
@Controller('file-storage')
export class FileStorageController {
  private readonly logger = new Logger(FileStorageController.name);

  constructor(private readonly fileStorageService: FileStorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload file lên Supabase Storage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File cần upload',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File cần upload',
        },
        bucket: {
          type: 'string',
          description: 'Bucket bắt buộc (profiles hoặc results)',
          example: 'profiles',
        },
        folder: {
          type: 'string',
          description: 'Thư mục trong bucket (tùy chọn)',
          example: 'medical-reports/',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File đã được upload thành công',
    type: UploadFileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'File không hợp lệ hoặc thiếu',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('bucket') bucket: string,
    @Body('folder') folder?: string,
  ): Promise<UploadFileResponseDto> {
    try {
      if (!file) {
        throw new HttpException(
          'Không có file được upload',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!bucket) {
        throw new HttpException('Thiếu bucket', HttpStatus.BAD_REQUEST);
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new HttpException(
          'File quá lớn. Kích thước tối đa là 10MB',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate file type
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];

      if (!allowedTypes.includes(file.mimetype)) {
        throw new HttpException(
          'Loại file không được hỗ trợ. Chỉ chấp nhận: JPEG, PNG, GIF, PDF, DOC, DOCX, TXT',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.fileStorageService.uploadFile(
        file,
        bucket,
        folder,
      );
      return result;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error(`Upload file error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi upload file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('url')
  @ApiOperation({ summary: 'Lấy URL công khai của file' })
  @ApiQuery({
    name: 'bucket',
    description: 'Bucket bắt buộc (profiles hoặc results)',
    example: 'profiles',
  })
  @ApiQuery({
    name: 'fileName',
    description: 'Tên file trong storage',
    example: 'uuid-medical-report.pdf',
  })
  @ApiQuery({
    name: 'folder',
    description: 'Thư mục trong bucket (tùy chọn)',
    example: 'medical-reports/',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy URL thành công',
    type: GetFileUrlResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'File không tìm thấy',
  })
  async getFileUrl(
    @Query('bucket') bucket: string,
    @Query('fileName') fileName: string,
    @Query('folder') folder?: string,
  ): Promise<GetFileUrlResponseDto> {
    try {
      if (!bucket) {
        throw new HttpException('Thiếu bucket', HttpStatus.BAD_REQUEST);
      }
      if (!fileName) {
        throw new HttpException('Thiếu tên file', HttpStatus.BAD_REQUEST);
      }

      const result = await this.fileStorageService.getFileUrl(
        bucket,
        fileName,
        folder,
      );
      return result;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error(`Get file URL error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi lấy URL file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':fileName')
  @ApiOperation({ summary: 'Xóa file khỏi storage' })
  @ApiParam({
    name: 'fileName',
    description: 'Tên file cần xóa',
    example: 'uuid-medical-report.pdf',
  })
  @ApiQuery({
    name: 'bucket',
    description: 'Bucket bắt buộc (profiles hoặc results)',
    example: 'profiles',
  })
  @ApiQuery({
    name: 'folder',
    description: 'Thư mục trong bucket (tùy chọn)',
    example: 'medical-reports/',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'File đã được xóa thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'File không tìm thấy',
  })
  async deleteFile(
    @Param('fileName') fileName: string,
    @Query('bucket') bucket: string,
    @Query('folder') folder?: string,
  ): Promise<{ message: string }> {
    try {
      if (!bucket) {
        throw new HttpException('Thiếu bucket', HttpStatus.BAD_REQUEST);
      }
      await this.fileStorageService.deleteFile(bucket, fileName, folder);
      return { message: 'File đã được xóa thành công' };
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error(`Delete file error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi xóa file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('list')
  @ApiOperation({ summary: 'Liệt kê các file trong thư mục' })
  @ApiQuery({
    name: 'bucket',
    description: 'Bucket bắt buộc (profiles hoặc results)',
    example: 'profiles',
  })
  @ApiQuery({
    name: 'folder',
    description: 'Thư mục cần liệt kê (tùy chọn)',
    example: 'medical-reports/',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Liệt kê file thành công',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          example: ['file1.pdf', 'file2.jpg', 'file3.docx'],
        },
      },
    },
  })
  async listFiles(
    @Query('bucket') bucket: string,
    @Query('folder') folder?: string,
  ): Promise<{ files: string[] }> {
    try {
      if (!bucket) {
        throw new HttpException('Thiếu bucket', HttpStatus.BAD_REQUEST);
      }
      const files = await this.fileStorageService.listFiles(bucket, folder);
      return { files };
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error(`List files error: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi liệt kê file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({ summary: 'Upload nhiều file lên Supabase Storage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Các file cần upload',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Danh sách file',
        },
        bucket: {
          type: 'string',
          description: 'Bucket bắt buộc (profiles hoặc results)',
          example: 'results',
        },
        folder: {
          type: 'string',
          description: 'Thư mục trong bucket (tùy chọn)',
          example: 'lab/',
        },
      },
    },
  })
  async uploadMultiple(
    @Body('bucket') bucket: string,
    @Body('folder') folder: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<UploadFileResponseDto[]> {
    try {
      if (!bucket) {
        throw new HttpException('Thiếu bucket', HttpStatus.BAD_REQUEST);
      }
      if (!files || !Array.isArray(files) || files.length === 0) {
        throw new HttpException('Không có file nào được upload', HttpStatus.BAD_REQUEST);
      }

      const result = await this.fileStorageService.uploadFiles(files, bucket, folder);
      return result;
    } catch (error) {
      this.logger.error(`Upload multiple files error: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Lỗi khi upload nhiều file', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('delete-many')
  @ApiOperation({ summary: 'Xóa nhiều file bằng tên/đường dẫn trong bucket' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', example: 'results' },
        items: {
          type: 'array',
          description: 'Danh sách fileName hoặc path tương đối trong bucket',
          items: { type: 'string' },
          example: ['lab/a.pdf', 'avatars/b.jpg'],
        },
      },
      required: ['bucket', 'items'],
    },
  })
  async deleteMany(
    @Body('bucket') bucket: string,
    @Body('items') items: string[],
  ): Promise<{ deleted: string[]; failed: string[] }> {
    try {
      if (!bucket) {
        throw new HttpException('Thiếu bucket', HttpStatus.BAD_REQUEST);
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw new HttpException('Thiếu danh sách files', HttpStatus.BAD_REQUEST);
      }
      return await this.fileStorageService.deleteFiles(bucket, items);
    } catch (error) {
      this.logger.error(`Delete many error: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Lỗi khi xóa nhiều file', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('delete-by-urls')
  @ApiOperation({ summary: 'Xóa nhiều file bằng URL công khai' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'https://xxx.supabase.co/storage/v1/object/public/results/a.pdf',
            'https://xxx.supabase.co/storage/v1/object/public/profiles/b.jpg',
          ],
        },
      },
      required: ['urls'],
    },
  })
  async deleteByUrls(@Body('urls') urls: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    try {
      if (!Array.isArray(urls) || urls.length === 0) {
        throw new HttpException('Thiếu danh sách URLs', HttpStatus.BAD_REQUEST);
      }
      return await this.fileStorageService.deleteByUrls(urls);
    } catch (error) {
      this.logger.error(`Delete by URLs error: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Lỗi khi xóa theo URL', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
