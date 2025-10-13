import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { DoctorRatingService } from './doctor-rating.service';
import { CreateDoctorRatingDto, UpdateDoctorRatingDto } from './dto';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { RolesGuard } from '../rbac/roles.guard';
import { CurrentUser, CurrentUserData } from '../rbac/current-user.decorator';

@Controller('doctor-ratings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorRatingController {
  constructor(private readonly doctorRatingService: DoctorRatingService) {}

  @Post()
  @Roles(Role.PATIENT)
  create(
    @Body() createDoctorRatingDto: CreateDoctorRatingDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.doctorRatingService.create(createDoctorRatingDto, user);
  }

  @Get('doctor/:doctorId')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.PATIENT)
  getDoctorRatings(
    @Param('doctorId') doctorId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    return this.doctorRatingService.getDoctorRatings(doctorId, page, limit);
  }

  @Get('doctor/:doctorId/stats')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.PATIENT)
  getDoctorRatingStats(@Param('doctorId') doctorId: string) {
    return this.doctorRatingService.getDoctorRatingStats(doctorId);
  }

  @Get('patient/my-ratings')
  @Roles(Role.PATIENT)
  getPatientRatings(
    @CurrentUser() user: CurrentUserData,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    return this.doctorRatingService.getPatientRatings(user, page, limit);
  }

  @Get('summaries')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  getAllDoctorRatingSummaries() {
    return this.doctorRatingService.getAllDoctorRatingSummaries();
  }

  @Get('admin/all-ratings')
  @Roles(Role.ADMIN)
  getAllRatings(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    return this.doctorRatingService.getAllRatings(page, limit);
  }

  @Patch(':id')
  @Roles(Role.PATIENT, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateDoctorRatingDto: UpdateDoctorRatingDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.doctorRatingService.update(id, updateDoctorRatingDto, user);
  }

  @Delete(':id')
  @Roles(Role.PATIENT, Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.doctorRatingService.remove(id, user);
  }
}
