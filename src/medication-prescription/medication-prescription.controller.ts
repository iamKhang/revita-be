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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      status: body.status,
      items,
    });
  }

  @Delete(':id')
  @Roles(Role.DOCTOR)
  async remove(@Param('id') id: string): Promise<unknown> {
    return this.service.delete(id);
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

  @Get('drugs/ndc/:ndc')
  @Public()
  async getByNdc(@Param('ndc') ndc: string): Promise<unknown> {
    return this.service.getDrugByNdc(ndc);
  }
}
