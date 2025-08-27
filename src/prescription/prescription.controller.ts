import { Body, Controller, Get, Param, Post, Patch, Delete } from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { Roles } from 'src/rbac/roles.decorator';
import { Role } from 'src/rbac/roles.enum';

@Controller('prescriptions')
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post()
  @Roles(Role.DOCTOR)
  async create(@Body() dto: CreatePrescriptionDto) {
    return this.prescriptionService.create(dto);
  }

  @Get(':code')
  @Roles(Role.DOCTOR, Role.PATIENT, Role.RECEPTIONIST, Role.CASHIER)
  async findByCode(@Param('code') code: string) {
    return this.prescriptionService.findByCode(code);
  }

  @Patch(':id')
  @Roles(Role.DOCTOR)
  async update(@Param('id') id: string, @Body() dto: UpdatePrescriptionDto) {
    return this.prescriptionService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.DOCTOR)
  async cancel(@Param('id') id: string) {
    return this.prescriptionService.cancel(id);
  }
}
