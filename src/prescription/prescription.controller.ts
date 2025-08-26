import { Body, Controller, Get, Param, Post, Patch, Delete } from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

@Controller('prescriptions')
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post()
  async create(@Body() dto: CreatePrescriptionDto) {
    return this.prescriptionService.create(dto);
  }

  @Get(':code')
  async findByCode(@Param('code') code: string) {
    return this.prescriptionService.findByCode(code);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePrescriptionDto) {
    return this.prescriptionService.update(id, dto);
  }

  @Delete(':id')
  async cancel(@Param('id') id: string) {
    return this.prescriptionService.cancel(id);
  }
}
