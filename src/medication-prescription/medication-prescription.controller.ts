import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { MedicationPrescriptionService } from './medication-prescription.service';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { Public } from '../rbac/public.decorator';
import { CreateMedicationPrescriptionDto } from './dto/create-medication-prescription.dto';
import { UpdateMedicationPrescriptionDto } from './dto/update-medication-prescription.dto';
import { JwtUserPayload } from '../medical-record/dto/jwt-user-payload.dto';
type ItemInput = {
  drugId?: string;
  name: string;
  ndc?: string;
  strength?: string;
  dosageForm?: string;
  route?: string;
  dose?: number;
  doseUnit?: string;
  frequency?: string;
  durationDays?: number;
  quantity?: number;
  quantityUnit?: string;
  instructions?: string;
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medication-prescriptions')
export class MedicationPrescriptionController {
  constructor(private readonly service: MedicationPrescriptionService) {}

  @Get('mine')
  @Roles(Role.DOCTOR)
  async listMine(
    @Req() req: { user: JwtUserPayload },
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ): Promise<unknown> {
    const doctorId = req.user.doctor?.id;
    if (!doctorId) {
      throw new Error('Doctor not found in token');
    }
    return this.service.listByDoctor(doctorId, Number(limit), Number(skip));
  }

  @Get('mine/profiles/:patientProfileId')
  @Roles(Role.PATIENT)
  async listMineByProfile(
    @Param('patientProfileId') patientProfileId: string,
    @Req() req: { user: JwtUserPayload },
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ): Promise<unknown> {
    const patientId = req.user.patient?.id;
    if (!patientId) {
      throw new Error('Patient not found in token');
    }
    return this.service.listByPatientProfile(
      patientId,
      patientProfileId,
      Number(limit),
      Number(skip),
    );
  }

  @Post()
  @Roles(Role.DOCTOR)
  async create(
    @Body() body: CreateMedicationPrescriptionDto,
    @Req() req: { user: JwtUserPayload },
  ): Promise<unknown> {
    const doctorId = req.user.doctor?.id;
    if (!doctorId) {
      throw new Error('Doctor not found in token');
    }
    const items: ItemInput[] = (body.items || []).map((i) => ({
      drugId: i.drugId,
      name: i.name,
      ndc: i.ndc,
      strength: i.strength,
      dosageForm: i.dosageForm,
      route: i.route,
      dose: i.dose,
      doseUnit: i.doseUnit,
      frequency: i.frequency,
      durationDays: i.durationDays,
      quantity: i.quantity,
      quantityUnit: i.quantityUnit,
      instructions: i.instructions,
    }));
    return this.service.create({
      code: body.code,
      doctorId,
      patientProfileId: body.patientProfileId,
      medicalRecordId: body.medicalRecordId,
      note: body.note ?? null,
      status: body.status,
      items,
    });
  }

  @Get(':code')
  @Roles(Role.DOCTOR, Role.PATIENT, Role.RECEPTIONIST)
  async getByCode(@Param('code') code: string): Promise<unknown> {
    return this.service.findByCode(code);
  }

  @Patch(':id')
  @Roles(Role.DOCTOR)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateMedicationPrescriptionDto,
  ): Promise<unknown> {
    const items: ItemInput[] | undefined = body.items
      ? body.items.map((i) => ({
          drugId: i.drugId,
          name: i.name,
          ndc: i.ndc,
          strength: i.strength,
          dosageForm: i.dosageForm,
          route: i.route,
          dose: i.dose,
          doseUnit: i.doseUnit,
          frequency: i.frequency,
          durationDays: i.durationDays,
          quantity: i.quantity,
          quantityUnit: i.quantityUnit,
          instructions: i.instructions,
        }))
      : undefined;
    return this.service.update(id, {
      note: body.note ?? null,
      status: body.status,
      items,
    });
  }

  @Delete(':id')
  @Roles(Role.DOCTOR)
  async remove(@Param('id') id: string): Promise<unknown> {
    return this.service.delete(id);
  }

  /**
   * Gửi phản hồi (khẩn cấp) về đơn thuốc
   */
  @Post(':id/feedback')
  @Roles(Role.PATIENT, Role.DOCTOR)
  async createFeedback(
    @Param('id') id: string,
    @Body()
    body: {
      message: string;
      isUrgent?: boolean;
    },
    @Req() req: { user: JwtUserPayload },
  ) {
    if (!body?.message || !body.message.trim()) {
      throw new BadRequestException('Nội dung phản hồi không được để trống');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return await this.service.createFeedback({
      prescriptionId: id,
      message: body.message.trim(),
      isUrgent: body.isUrgent ?? false,
      actor: {
        authId: req.user.id,
        role: req.user.role as Role,
        patientId: req.user.patient?.id,
        doctorId: req.user.doctor?.id,
      },
    });
  }

  /**
   * Admin xem tất cả feedback theo ngày (optional date=YYYY-MM-DD) và lọc theo khẩn cấp (optional isUrgent=true/false)
   */
  @Get('feedback/admin')
  @Roles(Role.ADMIN)
  async listFeedbackAdmin(
    @Query('date') date?: string,
    @Query('isUrgent') isUrgent?: string,
  ) {
    const isUrgentFilter =
      isUrgent !== undefined ? isUrgent === 'true' : undefined;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return await this.service.listFeedbackForAdmin(date, isUrgentFilter);
  }

  /**
   * Bác sĩ xem feedback của mình theo ngày (optional date=YYYY-MM-DD) và lọc theo khẩn cấp (optional isUrgent=true/false)
   */
  @Get('feedback/mine')
  @Roles(Role.DOCTOR)
  async listFeedbackDoctor(
    @Req() req: { user: JwtUserPayload },
    @Query('date') date?: string,
    @Query('isUrgent') isUrgent?: string,
  ) {
    const doctorId = req.user.doctor?.id;
    if (!doctorId) {
      throw new BadRequestException('Doctor not found in token');
    }
    const isUrgentFilter =
      isUrgent !== undefined ? isUrgent === 'true' : undefined;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return await this.service.listFeedbackForDoctor(
      doctorId,
      date,
      isUrgentFilter,
    );
  }

  /**
   * Bác sĩ xử lý feedback: ghi note phản hồi và đánh dấu đã xử lý
   */
  @Post(':id/feedback/respond')
  @Roles(Role.DOCTOR)
  async respondToFeedback(
    @Param('id') id: string,
    @Body()
    body: {
      responseNote: string;
    },
    @Req() req: { user: JwtUserPayload },
  ) {
    const doctorId = req.user.doctor?.id;
    if (!doctorId) {
      throw new BadRequestException('Doctor not found in token');
    }

    if (!body?.responseNote || !body.responseNote.trim()) {
      throw new BadRequestException('Nội dung phản hồi không được để trống');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return await this.service.handleFeedback({
      prescriptionId: id,
      responseNote: body.responseNote.trim(),
      doctorId,
    });
  }

  @Get('drugs/search/:query')
  @Public()
  async search(
    @Param('query') query: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ): Promise<unknown> {
    return this.service.searchDrugs(query, Number(limit), Number(skip));
  }

  @Get('drugs/search-partial/:query')
  @Public()
  async searchPartial(
    @Param('query') query: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ): Promise<unknown> {
    return this.service.searchDrugsPartial(query, Number(limit), Number(skip));
  }

  // Removed field-based and NDC endpoints; use full-text search only

  @Get('medical-record/:medicalRecordId')
  @Roles(Role.DOCTOR, Role.PATIENT, Role.RECEPTIONIST)
  async getByMedicalRecord(
    @Param('medicalRecordId') medicalRecordId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ): Promise<unknown> {
    return this.service.listByMedicalRecord(
      medicalRecordId,
      Number(limit),
      Number(skip),
    );
  }
}
