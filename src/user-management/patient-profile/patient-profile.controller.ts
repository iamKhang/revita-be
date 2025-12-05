import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Patch,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { PatientProfileService } from './patient-profile.service';
import { CreatePatientProfileDto } from '../dto/create-patient-profile.dto';
import { CreateIndependentPatientProfileDto } from '../dto/create-independent-patient-profile.dto';
import { SearchPatientProfileDto } from '../dto/search-patient-profile.dto';
import { LinkPatientProfileDto } from '../dto/link-patient-profile.dto';
import { JwtAuthGuard } from '../../login/jwt-auth.guard';
import { RolesGuard } from '../../rbac/roles.guard';
import { Roles } from '../../rbac/roles.decorator';
import { Role } from '../../rbac/roles.enum';
import { JwtUserPayload } from '../../medical-record/dto/jwt-user-payload.dto';
import { UpdatePatientProfileDto } from '../dto/update-patient-profile.dto';
import { Public } from 'src/rbac/public.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patient-profiles')
export class PatientProfileController {
  constructor(private readonly patientProfileService: PatientProfileService) {}

  @Post()
  @Roles(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST)
  async create(
    @Body() dto: CreatePatientProfileDto,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.patientProfileService.create(dto, req.user);
  }

  @Get()
  @Roles(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST)
  async findAll(@Request() req: { user: JwtUserPayload }) {
    return await this.patientProfileService.findAll(req.user);
  }

  // Tìm kiếm PatientProfile theo tên, số điện thoại hoặc mã hồ sơ
  @Get('search')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  async search(
    @Query() dto: SearchPatientProfileDto,
    @Request() req: { user: JwtUserPayload },
  ): Promise<unknown> {
    return await this.patientProfileService.search(dto, req.user);
  }

  // Lấy tất cả PatientProfile độc lập
  @Get('independent')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  async findIndependentProfiles(
    @Request() req: { user: JwtUserPayload },
  ): Promise<unknown> {
    return await this.patientProfileService.findIndependentProfiles(req.user);
  }

  // Tìm kiếm PatientProfile theo mã code chính xác
  @Get('code/:code')
  // @Roles(Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  @Public()
  async findByCode(
    @Param('code') code: string,
    @Request() req: { user?: JwtUserPayload | null },
  ): Promise<unknown> {
    return await this.patientProfileService.findByCode(code, req.user || null);
  }

  // Tìm kiếm nâng cao với nhiều tiêu chí
  @Get('advanced-search')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  async advancedSearch(
    @Query()
    dto: SearchPatientProfileDto & {
      gender?: string;
      ageMin?: number;
      ageMax?: number;
      isIndependent?: boolean;
    },
    @Request() req: { user: JwtUserPayload },
  ): Promise<unknown> {
    return await this.patientProfileService.advancedSearch(dto, req.user);
  }

  @Get('patient/:patientId')
  @Roles(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST)
  async findByPatient(
    @Param('patientId') patientId: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.patientProfileService.findByPatient(patientId, req.user);
  }

  @Get(':id')
  @Roles(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST)
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.patientProfileService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientProfileDto,
    @Request() req: { user: JwtUserPayload },
  ): Promise<unknown> {
    return await this.patientProfileService.update(id, dto, req.user);
  }

  // ===== NEW ENDPOINTS FOR INDEPENDENT PATIENT PROFILES =====

  // Tạo PatientProfile độc lập (chỉ cho staff)
  @Post('independent')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  async createIndependent(
    @Body() dto: CreateIndependentPatientProfileDto,
    @Request() req: { user: JwtUserPayload },
  ): Promise<unknown> {
    return await this.patientProfileService.createIndependent(dto, req.user);
  }

  // Liên kết PatientProfile với Patient
  @Patch(':id/link')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  async linkToPatient(
    @Param('id') id: string,
    @Body() dto: LinkPatientProfileDto,
    @Request() req: { user: JwtUserPayload },
  ): Promise<unknown> {
    return await this.patientProfileService.linkToPatient(id, dto, req.user);
  }

  // Hủy liên kết PatientProfile với Patient
  @Patch(':id/unlink')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER)
  async unlinkFromPatient(
    @Param('id') id: string,
    @Request() req: { user: JwtUserPayload },
  ): Promise<unknown> {
    return await this.patientProfileService.unlinkFromPatient(id, req.user);
  }
}
