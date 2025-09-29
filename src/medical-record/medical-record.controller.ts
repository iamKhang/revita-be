/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Patch,
  Delete,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFiles,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { MedicalRecordService } from './medical-record.service';
import {
  CreateMedicalRecordDto,
  RemoveAttachmentsDto,
} from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { JwtUserPayload } from './dto/jwt-user-payload.dto';
import { FileStorageService } from '../file-storage/file-storage.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Medical Records')
@Controller('medical-records')
export class MedicalRecordController {
  constructor(
    private readonly medicalRecordService: MedicalRecordService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  @Post()
  @Roles(Role.DOCTOR, Role.ADMIN)
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({
    summary: 'Tạo hồ sơ bệnh án mới với khả năng upload file đính kèm',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Tạo hồ sơ bệnh án với files đính kèm (optional)',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Danh sách file đính kèm (tùy chọn)',
        },
        patientProfileId: {
          type: 'string',
          description: 'ID của hồ sơ bệnh nhân',
        },
        templateId: {
          type: 'string',
          description: 'ID của template bệnh án',
        },
        doctorId: {
          type: 'string',
          description:
            'ID của bác sĩ hoặc authId của bác sĩ (tùy chọn cho admin)',
        },
        appointmentId: {
          type: 'string',
          description: 'ID của cuộc hẹn (tùy chọn)',
        },
        status: {
          type: 'string',
          enum: ['DRAFT', 'IN_PROGRESS', 'COMPLETED'],
          description: 'Trạng thái hồ sơ bệnh án',
        },
        content: {
          type: 'string',
          description: 'Nội dung bệnh án theo template (JSON string)',
          example:
            '{"chief_complaint":"Đau đầu","diagnosis":"Stress","treatment_plan":"Nghỉ ngơi"}',
        },
      },
    },
  })
  async create(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: { user: JwtUserPayload },
  ) {
    try {
      // Parse content from string to object if needed

      let content = body.content;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch (error) {
          console.error(error);
          throw new HttpException(
            'Content phải là JSON hợp lệ',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Create DTO from body
      const dto: CreateMedicalRecordDto = {
        patientProfileId: body.patientProfileId,
        templateId: body.templateId,
        doctorId: body.doctorId,
        appointmentId: body.appointmentId,
        status: body.status,
        content: content || {},
      };

      // Create medical record first
      const medicalRecord = await this.medicalRecordService.create(
        dto,
        req.user,
      );

      // If files are provided, upload them and update the record
      if (files && Array.isArray(files) && files.length > 0) {
        // Upload files to results bucket
        const uploadResults = await this.fileStorageService.uploadFiles(
          files,
          'results',
          `medical-records/${medicalRecord.id}`,
        );

        // Create attachments metadata
        const attachments = uploadResults.map((result) => ({
          filename: result.originalName,
          filetype: result.mimeType,
          url: result.url,
          uploadedAt: result.uploadedAt,
        }));

        // Update medical record content with attachments
        const updatedContent: Record<string, any> = {
          ...((medicalRecord.content as Record<string, any>) || {}),
          attachments: attachments,
        };

        // Update the medical record with attachments
        const updatedRecord = await this.medicalRecordService.update(
          medicalRecord.id,
          { content: updatedContent },
          req.user,
        );

        return {
          ...updatedRecord,
          uploadedFiles: attachments,
          message: 'Hồ sơ bệnh án đã được tạo thành công với file đính kèm',
        };
      }

      return {
        ...medicalRecord,
        message: 'Hồ sơ bệnh án đã được tạo thành công',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi tạo hồ sơ bệnh án',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async findAll(
    @Request() req: { user: JwtUserPayload },
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return await this.medicalRecordService.findAll(req.user, page, limit);
  }

  @Get('patient-profile/:patientProfileId')
  async findByPatientProfile(
    @Param('patientProfileId') patientProfileId: string,
    @Request() req: { user: JwtUserPayload },
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return await this.medicalRecordService.findByPatientProfile(
      patientProfileId,
      req.user,
      page,
      limit,
    );
  }

  @Get('templates')
  async getTemplates() {
    return await this.medicalRecordService.getTemplates();
  }

  @Get('templates/:templateId')
  async getTemplateById(@Param('templateId') templateId: string) {
    return await this.medicalRecordService.getTemplateById(templateId);
  }

  @Get(':id/template')
  async getTemplateByMedicalRecord(@Param('id') id: string) {
    return await this.medicalRecordService.getTemplateByMedicalRecord(id);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.medicalRecordService.findOne(id, req.user);
  }

  @Patch(':id')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({
    summary: 'Cập nhật hồ sơ bệnh án với khả năng upload file đính kèm',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Cập nhật hồ sơ bệnh án với files đính kèm (optional)',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Danh sách file đính kèm mới (tùy chọn)',
        },
        content: {
          type: 'string',
          description: 'Nội dung bệnh án cần cập nhật (JSON string)',
          example:
            '{"chief_complaint":"Đau đầu","diagnosis":"Stress","treatment_plan":"Nghỉ ngơi"}',
        },
        status: {
          type: 'string',
          enum: ['DRAFT', 'IN_PROGRESS', 'COMPLETED'],
          description: 'Trạng thái hồ sơ bệnh án',
        },
        appendFiles: {
          type: 'boolean',
          description:
            'true: thêm file vào danh sách hiện tại, false: thay thế hoàn toàn (default: true)',
          default: true,
        },
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: { user: JwtUserPayload },
  ) {
    try {
      // Get current medical record to verify permission
      const currentRecord = await this.medicalRecordService.findOne(
        id,
        req.user,
      );

      // Parse content from string to object if needed
      let content = body.content;
      if (content && typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch (error) {
          console.error(error);
          throw new HttpException(
            'Content phải là JSON hợp lệ',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Handle file uploads if provided
      let finalContent = content;
      const uploadedFiles: any[] = [];

      if (files && Array.isArray(files) && files.length > 0) {
        // Upload files to results bucket
        const uploadResults = await this.fileStorageService.uploadFiles(
          files,
          'results',
          `medical-records/${id}`,
        );

        // Create attachments metadata
        const newAttachments = uploadResults.map((result) => ({
          filename: result.originalName,
          filetype: result.mimeType,
          url: result.url,
          uploadedAt: result.uploadedAt,
        }));

        uploadedFiles.push(...newAttachments);

        // Determine how to handle existing attachments
        const appendFiles =
          body.appendFiles !== 'false' && body.appendFiles !== false;
        const currentContent = currentRecord.content as Record<string, any>;
        const existingAttachments = (currentContent.attachments as any[]) || [];

        // Merge content with attachments
        finalContent = {
          ...(currentContent || {}),
          ...(content || {}),

          attachments: appendFiles
            ? [...existingAttachments, ...newAttachments]
            : newAttachments,
        };
      }

      // Create DTO for update
      const dto: UpdateMedicalRecordDto = {
        content: finalContent,
        status: body.status,
      };

      // Update medical record
      const updatedRecord = await this.medicalRecordService.update(
        id,
        dto,
        req.user,
      );

      return {
        ...updatedRecord,
        uploadedFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
        message:
          uploadedFiles.length > 0
            ? 'Hồ sơ bệnh án đã được cập nhật thành công với file đính kèm'
            : 'Hồ sơ bệnh án đã được cập nhật thành công',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi cập nhật hồ sơ bệnh án',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.medicalRecordService.remove(id, req.user);
  }

  @Post(':id/attachments')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({ summary: 'Upload file đính kèm cho hồ sơ bệnh án' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Files đính kèm cho hồ sơ bệnh án',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Danh sách file đính kèm',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Files đã được upload thành công',
  })
  async uploadAttachments(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: { user: JwtUserPayload },
  ) {
    try {
      // Verify medical record exists and user has permission
      const medicalRecord = await this.medicalRecordService.findOne(
        id,
        req.user,
      );

      if (!files || !Array.isArray(files) || files.length === 0) {
        throw new HttpException(
          'Không có file nào được upload',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Upload files to results bucket with medical-records folder
      const uploadResults = await this.fileStorageService.uploadFiles(
        files,
        'results',
        `medical-records/${id}`,
      );

      // Update medical record content with new attachments
      const currentContent = medicalRecord.content as Record<string, any>;
      const currentAttachments = (currentContent.attachments as any[]) || [];

      const newAttachments = uploadResults.map((result) => ({
        filename: result.originalName,
        filetype: result.mimeType,
        url: result.url,
        uploadedAt: result.uploadedAt,
      }));

      const updatedContent: Record<string, any> = {
        ...currentContent,

        attachments: [...currentAttachments, ...newAttachments],
      };

      // Update medical record with new content
      await this.medicalRecordService.update(
        id,
        { content: updatedContent },
        req.user,
      );

      return {
        message: 'Files đã được upload thành công',
        attachments: newAttachments,
        totalAttachments: (updatedContent.attachments as any[]).length,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi upload files',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id/attachments')
  @ApiOperation({ summary: 'Xóa file đính kèm khỏi hồ sơ bệnh án' })
  async removeAttachments(
    @Param('id') id: string,
    @Body() removeAttachmentsDto: RemoveAttachmentsDto,
    @Request() req: { user: JwtUserPayload },
  ) {
    try {
      // Verify medical record exists and user has permission
      const medicalRecord = await this.medicalRecordService.findOne(
        id,
        req.user,
      );

      const { urls } = removeAttachmentsDto;

      if (!Array.isArray(urls) || urls.length === 0) {
        throw new HttpException('Thiếu danh sách URLs', HttpStatus.BAD_REQUEST);
      }

      // Delete files from storage
      const deleteResult = await this.fileStorageService.deleteByUrls(urls);

      // Update medical record content to remove deleted attachments
      const currentContent = medicalRecord.content as Record<string, any>;
      const currentAttachments = (currentContent.attachments as any[]) || [];

      const updatedAttachments = currentAttachments.filter(
        (attachment: any) => !urls.includes(attachment.url as string),
      );

      const updatedContent: Record<string, any> = {
        ...currentContent,
        attachments: updatedAttachments,
      };

      // Update medical record with new content
      await this.medicalRecordService.update(
        id,
        { content: updatedContent },
        req.user,
      );

      return {
        message: 'Files đã được xóa thành công',
        deletedFiles: deleteResult.deleted,
        failedFiles: deleteResult.failed,
        remainingAttachments: updatedAttachments.length,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Lỗi khi xóa files',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
