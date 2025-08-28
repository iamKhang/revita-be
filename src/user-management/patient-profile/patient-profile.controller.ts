import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Patch,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PatientProfileService } from './patient-profile.service';
import { CreatePatientProfileDto } from '../dto/create-patient-profile.dto';
import { JwtAuthGuard } from '../../login/jwt-auth.guard';
import { RolesGuard } from '../../rbac/roles.guard';
import { Roles } from '../../rbac/roles.decorator';
import { Role } from '../../rbac/roles.enum';
import { JwtUserPayload } from '../../medical-record/dto/jwt-user-payload.dto';
import { UpdatePatientProfileDto } from '../dto/update-patient-profile.dto';

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

  @Get(':id')
  @Roles(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST)
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.patientProfileService.findOne(id, req.user);
  }

  @Get('patient/:patientId')
  @Roles(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST)
  async findByPatient(
    @Param('patientId') patientId: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return await this.patientProfileService.findByPatient(patientId, req.user);
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
}
