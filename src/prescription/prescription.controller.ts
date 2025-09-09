import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { Roles } from 'src/rbac/roles.decorator';
import { Role } from 'src/rbac/roles.enum';
import { JwtAuthGuard } from 'src/login/jwt-auth.guard';
import { RolesGuard } from 'src/rbac/roles.guard';
import { JwtUserPayload } from 'src/medical-record/dto/jwt-user-payload.dto';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post()
  @Roles(Role.DOCTOR)
  async create(@Body() dto: CreatePrescriptionDto, @Request() req: { user: JwtUserPayload }) {
    const user = req.user;
    return this.prescriptionService.create(dto, user);
  }

  @Get(':code')
  @Roles(Role.DOCTOR, Role.PATIENT, Role.RECEPTIONIST, Role.CASHIER)
  async findByCode(@Param('code') code: string) {
    return this.prescriptionService.findByCode(code);
  }

  @Get('medical-record/:medicalRecordId')
  @Roles(Role.DOCTOR, Role.PATIENT, Role.RECEPTIONIST, Role.CASHIER)
  async getByMedicalRecord(@Param('medicalRecordId') medicalRecordId: string) {
    return this.prescriptionService.getPrescriptionsByMedicalRecord(
      medicalRecordId,
    );
  }

  @Patch(':id')
  @Roles(Role.DOCTOR)
  async update(@Param('id') id: string, @Body() dto: UpdatePrescriptionDto, @Request() req: { user: JwtUserPayload }) {
    return this.prescriptionService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(Role.DOCTOR)
  async cancel(@Param('id') id: string, @Request() req: { user: JwtUserPayload }) {
    return this.prescriptionService.cancel(id, req.user);
  }

  // Service status transitions by code + serviceId
  @Post(':code/services/:serviceId/serving')
  @Roles(Role.DOCTOR)
  async markServiceServing(
    @Param('code') code: string,
    @Param('serviceId') serviceId: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    const prescription = await this.prescriptionService.findByCode(code);
    await this.prescriptionService.markServiceServing(prescription.id, serviceId, req.user);
    return { ok: true };
  }

  @Post(':code/services/:serviceId/waiting-result')
  @Roles(Role.DOCTOR)
  async markServiceWaitingResult(
    @Param('code') code: string,
    @Param('serviceId') serviceId: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    const prescription = await this.prescriptionService.findByCode(code);
    await this.prescriptionService.markServiceWaitingResult(prescription.id, serviceId, req.user);
    return { ok: true };
  }

  @Post(':code/services/:serviceId/completed')
  @Roles(Role.DOCTOR)
  async markServiceCompleted(
    @Param('code') code: string,
    @Param('serviceId') serviceId: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    const prescription = await this.prescriptionService.findByCode(code);
    await this.prescriptionService.markServiceCompleted(prescription.id, serviceId, req.user);
    return { ok: true };
  }
}
