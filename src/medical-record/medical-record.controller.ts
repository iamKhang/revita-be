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
} from '@nestjs/common';
import { MedicalRecordService } from './medical-record.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { JwtUserPayload } from './dto/jwt-user-payload.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medical-records')
export class MedicalRecordController {
  constructor(private readonly medicalRecordService: MedicalRecordService) {}

  @Post()
  @Roles(Role.DOCTOR, Role.SYSTEM_ADMIN, Role.CLINIC_ADMIN)
  async create(
    @Body() dto: CreateMedicalRecordDto,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.medicalRecordService.create(dto, req.user);
  }

  @Get()
  async findAll(@Request() req: { user: JwtUserPayload }) {
    return await this.medicalRecordService.findAll(req.user);
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
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMedicalRecordDto,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.medicalRecordService.update(id, dto, req.user);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.medicalRecordService.remove(id, req.user);
  }
}
