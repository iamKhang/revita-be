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
import { ClinicRoomService } from './clinic-room.service';
import { CreateClinicRoomDto, UpdateClinicRoomDto } from '../dto/clinic-room.dto';

@Controller('clinic-rooms')
export class ClinicRoomController {
  constructor(private readonly clinicRoomService: ClinicRoomService) {}

  @Post()
  async createClinicRoom(@Body() createClinicRoomDto: CreateClinicRoomDto) {
    return this.clinicRoomService.createClinicRoom(createClinicRoomDto);
  }

  @Get()
  async findAllClinicRooms(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('specialtyId') specialtyId?: string,
  ) {
    return this.clinicRoomService.findAllClinicRooms(
      parseInt(page || '1', 10) || 1,
      parseInt(limit || '10', 10) || 10,
      specialtyId,
    );
  }

  @Get(':id')
  async findClinicRoomById(@Param('id') id: string) {
    return this.clinicRoomService.findClinicRoomById(id);
  }

  @Put(':id')
  async updateClinicRoom(
    @Param('id') id: string,
    @Body() updateClinicRoomDto: UpdateClinicRoomDto,
  ) {
    return this.clinicRoomService.updateClinicRoom(id, updateClinicRoomDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClinicRoom(@Param('id') id: string) {
    await this.clinicRoomService.deleteClinicRoom(id);
    return { message: 'Clinic room deleted successfully' };
  }
}

