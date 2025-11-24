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
import { BoothService } from './booth.service';
import {
  CreateBoothDto,
  UpdateBoothDto,
  BoothServiceAssignmentDto,
  SaveBoothServicesDto,
} from '../dto/booth.dto';

@Controller('booths')
export class BoothController {
  constructor(private readonly boothService: BoothService) {}

  @Post()
  async createBooth(@Body() createBoothDto: CreateBoothDto) {
    return this.boothService.createBooth(createBoothDto);
  }

  @Get()
  async findAllBooths(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('roomId') roomId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.boothService.findAllBooths(
      parseInt(page || '1', 10) || 1,
      parseInt(limit || '10', 10) || 10,
      roomId,
      isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    );
  }

  @Get(':id')
  async findBoothById(@Param('id') id: string) {
    return this.boothService.findBoothById(id);
  }

  @Put(':id')
  async updateBooth(
    @Param('id') id: string,
    @Body() updateBoothDto: UpdateBoothDto,
  ) {
    return this.boothService.updateBooth(id, updateBoothDto);
  }

  @Get(':id/services')
  async getBoothServices(@Param('id') id: string) {
    return this.boothService.getBoothServices(id);
  }

  @Get(':id/available-services')
  async getAvailableServices(
    @Param('id') id: string,
    @Query('query') query?: string,
    @Query('limit') limit?: string,
  ) {
    return this.boothService.getAvailableServices(
      id,
      query,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Put(':id/services')
  async saveBoothServices(
    @Param('id') id: string,
    @Body() dto: SaveBoothServicesDto,
  ) {
    return this.boothService.saveBoothServices(id, dto);
  }

  @Post(':id/services')
  async assignServiceToBooth(
    @Param('id') id: string,
    @Body() dto: BoothServiceAssignmentDto,
  ) {
    return this.boothService.assignServiceToBooth(id, dto.serviceId);
  }

  @Delete(':boothId/services/:serviceId')
  @HttpCode(HttpStatus.OK)
  async removeServiceFromBooth(
    @Param('boothId') boothId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.boothService.removeServiceFromBooth(boothId, serviceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBooth(@Param('id') id: string) {
    await this.boothService.deleteBooth(id);
    return { message: 'Booth deleted successfully' };
  }
}
