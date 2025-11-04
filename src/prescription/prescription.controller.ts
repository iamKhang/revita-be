import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Patch,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Roles } from 'src/rbac/roles.decorator';
import { Role } from 'src/rbac/roles.enum';
import { JwtAuthGuard } from 'src/login/jwt-auth.guard';
import { RolesGuard } from 'src/rbac/roles.guard';
import { JwtUserPayload } from 'src/medical-record/dto/jwt-user-payload.dto';
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionServiceManagementService } from '../service/prescription-service-management.service';
import {
  UpdateServiceStatusDto,
  UpdateServiceResultsDto,
  UpdateServiceStatusResponseDto,
  UpdateResultsResponseDto,
} from '../service/dto';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionController {
  constructor(
    private readonly prescriptionService: PrescriptionService,
    private readonly prescriptionServiceManagement: PrescriptionServiceManagementService,
  ) {}

  @Post()
  @Roles(Role.DOCTOR)
  async create(
    @Body() dto: CreatePrescriptionDto,
    @Request() req: { user: JwtUserPayload },
  ) {
    const user = req.user;
    return this.prescriptionService.create(dto, user);
  }

  @Get(':code')
  @Roles(Role.DOCTOR, Role.PATIENT, Role.RECEPTIONIST, Role.CASHIER)
  async findByCode(
    @Param('code') code: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return this.prescriptionService.findByCodeForUser(code, req.user);
  }

  @Get('medical-record/:medicalRecordId')
  @Roles(Role.DOCTOR, Role.PATIENT, Role.RECEPTIONIST, Role.CASHIER)
  async getByMedicalRecord(
    @Param('medicalRecordId') medicalRecordId: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return this.prescriptionService.getPrescriptionsByMedicalRecordForUser(
      medicalRecordId,
      req.user,
    );
  }

  // Patients can query their own prescriptions by patient profile
  @Get('my/profile/:patientProfileId')
  @Roles(Role.PATIENT)
  async getMyPrescriptionsByProfile(
    @Param('patientProfileId') patientProfileId: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return this.prescriptionService.getMyPrescriptionsByProfile(
      patientProfileId,
      req.user,
    );
  }

  // // OpenFDA proxy endpoints for drug lookup
  // @Get('drugs/search/:query')
  // @Roles(Role.DOCTOR, Role.PATIENT, Role.RECEPTIONIST)
  // async searchDrugs(@Param('query') query: string) {
  //   return this.prescriptionService.searchDrugsOpenFda(query);
  // }

  // @Get('drugs/ndc/:ndc')
  // @Roles(Role.DOCTOR, Role.PATIENT, Role.RECEPTIONIST)
  // async getDrugByNdc(@Param('ndc') ndc: string) {
  //   return this.prescriptionService.getDrugByNdcOpenFda(ndc);
  // }

  @Patch(':id')
  @Roles(Role.DOCTOR)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePrescriptionDto,
    @Request() req: { user: JwtUserPayload },
  ) {
    return this.prescriptionService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(Role.DOCTOR)
  async cancel(
    @Param('id') id: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return this.prescriptionService.cancel(id, req.user);
  }

  @Put('prescription-service/status')
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  async updateServiceStatus(
    @Body() updateDto: UpdateServiceStatusDto,
    @Request() req: { user: JwtUserPayload },
  ): Promise<UpdateServiceStatusResponseDto> {
    const userId = req.user.id;
    const userRole = req.user.role;
    return this.prescriptionServiceManagement.updateServiceStatus(
      updateDto.prescriptionId,
      updateDto.serviceId,
      updateDto.status,
      userId,
      userRole,
      updateDto.note,
    );
  }

  @Put('prescription-service/results')
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  async updateServiceResults(
    @Body() updateDto: UpdateServiceResultsDto,
    @Request() req: { user: JwtUserPayload },
  ): Promise<UpdateResultsResponseDto> {
    const userId = req.user.id;
    const userRole = req.user.role;
    return this.prescriptionServiceManagement.updateServiceResults(
      updateDto.prescriptionId,
      updateDto.serviceId,
      updateDto.results,
      userId,
      userRole,
      updateDto.note,
    );
  }
}
