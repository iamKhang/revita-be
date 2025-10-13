import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { Role } from '@prisma/client';

@Controller('staff') // no auth guards as requested for testing
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  async create(@Body() body: CreateStaffDto) {
    return this.staffService.createStaff(body);
  }

  @Get()
  async list(
    @Query('role') role?: Role,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.staffService.listStaff({
      role: role as Role | undefined,
      page: parseInt(page || '1', 10) || 1,
      limit: parseInt(limit || '10', 10) || 10,
    });
  }

  @Get(':authId')
  async detail(@Param('authId') authId: string) {
    return this.staffService.getStaffByAuthId(authId);
  }

  @Put(':authId')
  async update(@Param('authId') authId: string, @Body() body: UpdateStaffDto) {
    return this.staffService.updateStaff(authId, body);
  }

  @Delete(':authId')
  async deactivate(@Param('authId') authId: string) {
    return this.staffService.deactivateStaff(authId);
  }
}

