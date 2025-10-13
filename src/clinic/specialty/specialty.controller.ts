import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SpecialtyService } from './specialty.service';
import { CreateSpecialtyDto, UpdateSpecialtyDto } from '../dto/specialty.dto';

@Controller('specialties')
export class SpecialtyController {
  constructor(private readonly specialtyService: SpecialtyService) {}

  @Post()
  async createSpecialty(@Body() createSpecialtyDto: CreateSpecialtyDto) {
    return this.specialtyService.createSpecialty(createSpecialtyDto);
  }

  @Get()
  async findAllSpecialties(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.specialtyService.findAllSpecialties(
      parseInt(page || '1', 10) || 1,
      parseInt(limit || '10', 10) || 10,
    );
  }

  @Get(':id')
  async findSpecialtyById(@Param('id') id: string) {
    return this.specialtyService.findSpecialtyById(id);
  }

  @Put(':id')
  async updateSpecialty(
    @Param('id') id: string,
    @Body() updateSpecialtyDto: UpdateSpecialtyDto,
  ) {
    return this.specialtyService.updateSpecialty(id, updateSpecialtyDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSpecialty(@Param('id') id: string) {
    await this.specialtyService.deleteSpecialty(id);
    return { message: 'Specialty deleted successfully' };
  }
}

