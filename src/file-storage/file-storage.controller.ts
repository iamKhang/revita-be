import {
  Controller,
  Post,
  Get,
  Delete,
  UploadedFile,
  Query,
  UseInterceptors,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  GetFileUrlDto,
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
    @Body('folder') folder?: string,
  ): Promise<UploadFileResponseDto> {
    try {
      if (!file) {
        throw new HttpException('Không có file được upload', HttpStatus.BAD_REQUEST);
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

      const result = await this.fileStorageService.uploadFile(file, folder);
      return result;
    } catch (error) {
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
    @Query('fileName') fileName: string,
    @Query('folder') folder?: string,
  ): Promise<GetFileUrlResponseDto> {
    try {
      if (!fileName) {
        throw new HttpException(
          'Thiếu tên file',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.fileStorageService.getFileUrl(fileName, folder);
      return result;
    } catch (error) {
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
    @Query('folder') folder?: string,
  ): Promise<{ message: string }> {
    try {
      await this.fileStorageService.deleteFile(fileName, folder);
      return { message: 'File đã được xóa thành công' };
    } catch (error) {
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
  async listFiles(@Query('folder') folder?: string): Promise<{ files: string[] }> {
    try {
      const files = await this.fileStorageService.listFiles(folder);
      return { files };
    } catch (error) {
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
}


