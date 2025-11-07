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
  Query,
} from '@nestjs/common';
import { Roles } from 'src/rbac/roles.decorator';
import { Public } from 'src/rbac/public.decorator';
import { Role } from 'src/rbac/roles.enum';
import { JwtAuthGuard } from 'src/login/jwt-auth.guard';
import { RolesGuard } from 'src/rbac/roles.guard';
import { JwtUserPayload } from 'src/medical-record/dto/jwt-user-payload.dto';
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { QueueResponseDto } from './dto/queue-item.dto';
import {
  StartServicesDto,
  StartServicesResponseDto,
} from './dto/start-services.dto';
import { PendingServicesResponseDto } from './dto/pending-services.dto';
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
  @Roles(Role.DOCTOR, Role.RECEPTIONIST)
  async create(
    @Body() dto: CreatePrescriptionDto,
    @Request() req: { user: JwtUserPayload },
  ) {
    const user = req.user;
    return this.prescriptionService.create(dto, user);
  }
  // Lấy danh sách bệnh nhân đang trong hàng chờ cho bác sĩ và kỹ thuật viên
  @Get('queue')
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  async getQueue(
    @Request() req: { user: JwtUserPayload },
  ): Promise<QueueResponseDto> {
    return this.prescriptionService.getQueueForUser(req.user);
  }

  @Get()
  @Roles(Role.RECEPTIONIST, Role.DOCTOR)
  async findAll(
    @Request() req: { user: JwtUserPayload },
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.prescriptionService.findAll(req.user, page, limit);
  }

  @Get('services')
  @Roles(Role.RECEPTIONIST, Role.DOCTOR)
  async getAllServices(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveFilter =
      isActive !== undefined ? isActive === 'true' : undefined;
    return this.prescriptionService.getAllServices(
      page,
      limit,
      search,
      isActiveFilter,
    );
  }

  @Get('doctors/by-service')
  @Roles(Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN)
  async getDoctorsByService(
    @Request() req: { user: JwtUserPayload },
    @Query('serviceId') serviceId?: string,
    @Query('serviceCode') serviceCode?: string,
  ) {
    return this.prescriptionService.getDoctorsByService(serviceId, serviceCode);
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

  @Get(':code')
  @Roles(Role.DOCTOR, Role.PATIENT, Role.RECEPTIONIST, Role.CASHIER)
  async findByCode(
    @Param('code') code: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return this.prescriptionService.findByCodeForUser(code, req.user);
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

  // Chuyển các PrescriptionService từ PENDING sang WAITING và thêm vào queue
  @Post('start-services')
  @Public()
  async startServices(
    @Body() dto: StartServicesDto,
    @Request() req: { user: JwtUserPayload },
  ): Promise<StartServicesResponseDto> {
    return this.prescriptionService.startServices(dto, req.user);
  }

  // Lấy các dịch vụ PENDING liên tiếp có cùng bác sĩ/kỹ thuật viên (không cần quyền)
  @Get('pending-services/:prescriptionCode')
  @Public()
  async getPendingServices(
    @Param('prescriptionCode') prescriptionCode: string,
  ): Promise<PendingServicesResponseDto> {
    return this.prescriptionService.getPendingServicesByPrescriptionCode(
      prescriptionCode,
    );
  }

  @Post('assign-next-service')
  @Public()
  async assignNextService(
    @Body() body: { prescriptionCode: string },
  ) {
    return this.prescriptionService.assignNextPendingService(body.prescriptionCode);
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
  @Roles(Role.DOCTOR, Role.RECEPTIONIST)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePrescriptionDto,
    @Request() req: { user: JwtUserPayload },
  ) {
    return this.prescriptionService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(Role.DOCTOR, Role.RECEPTIONIST)
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

  @Put('prescription-service/skip')
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  async skipService(
    @Body() body: { prescriptionId: string; serviceId: string },
    @Request() req: { user: JwtUserPayload },
  ) {
    return this.prescriptionService.markServiceSkipped(
      body.prescriptionId,
      body.serviceId,
      req.user,
    );
  }

  @Post('call-next-patient')
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  async callNextPatient(@Request() req: { user: JwtUserPayload }) {
    return this.prescriptionService.callNextPatient(req.user);
  }

  @Get('queue/status')
  @Roles(Role.DOCTOR, Role.TECHNICIAN)
  async getQueueStatus(@Request() req: { user: JwtUserPayload }) {
    const queueData = await this.prescriptionService.getQueueForUser(req.user);

    // Tìm bệnh nhân đang SERVING và PREPARING
    const servingPatient = queueData.patients.find(
      (p) => p.overallStatus === 'SERVING',
    );
    const preparingPatient = queueData.patients.find(
      (p) => p.overallStatus === 'PREPARING',
    );

    return {
      totalPatients: queueData.totalCount,
      servingPatient: servingPatient
        ? {
            patientProfileId: servingPatient.patientProfileId,
            patientName: servingPatient.patientName,
            prescriptionCode: servingPatient.prescriptionCode,
            services: servingPatient.services,
          }
        : null,
      preparingPatient: preparingPatient
        ? {
            patientProfileId: preparingPatient.patientProfileId,
            patientName: preparingPatient.patientName,
            prescriptionCode: preparingPatient.prescriptionCode,
            services: preparingPatient.services,
          }
        : null,
      waitingPatients: queueData.patients
        .filter(
          (p) => p.overallStatus === 'WAITING' || p.overallStatus === 'SKIPPED',
        )
        .map((p) => ({
          patientProfileId: p.patientProfileId,
          patientName: p.patientName,
          prescriptionCode: p.prescriptionCode,
          overallStatus: p.overallStatus,
          queueOrder: p.queueOrder,
        })),
    };
  }
  // ======= Appointment-based endpoints =======
  @Get('appointment/:appointmentCode')
  @Roles(Role.RECEPTIONIST, Role.DOCTOR)
  async getAppointmentByCode(
    @Param('appointmentCode') appointmentCode: string,
  ) {
    return this.prescriptionService.getAppointmentByCode(appointmentCode);
  }

  @Post('appointment/:appointmentCode/create-prescription')
  @Roles(Role.RECEPTIONIST, Role.DOCTOR)
  async createPrescriptionFromAppointment(
    @Param('appointmentCode') appointmentCode: string,
    @Request() req: { user: JwtUserPayload },
  ) {
    return this.prescriptionService.createPrescriptionFromAppointment(
      appointmentCode,
      req.user,
    );
  }
}
