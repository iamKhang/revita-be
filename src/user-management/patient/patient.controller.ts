import {
  Controller,
  Put,
  Body,
  UseGuards,
  Req,
  NotFoundException,
  Get,
} from '@nestjs/common';
import { Roles } from '../../rbac/roles.decorator';
import { Role } from '../../rbac/roles.enum';
import { RolesGuard } from '../../rbac/roles.guard';
import { PrismaClient } from '@prisma/client';
import { UpdatePatientDto } from '../dto/update-patient.dto';
import { JwtAuthGuard } from '../../login/jwt-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientController {
  private prisma = new PrismaClient();

  @Put('me')
  @Roles(Role.PATIENT)
  async updateProfile(@Req() req: any, @Body() body: UpdatePatientDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user?.id;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.log(req.user);
    if (!userId) throw new NotFoundException('User not found');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await this.prisma.auth.update({ where: { id: userId }, data: body });

    return this.prisma.patient.update({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: { authId: userId },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: body as any,
    });
  }

  @Get('me/medical-records')
  @Roles(Role.PATIENT)
  async viewMedicalRecords(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = req.user?.id;
    if (!userId) throw new NotFoundException('User not found');

    const patient = await this.prisma.patient.findUnique({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: { authId: userId },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return this.prisma.medicalRecord.findMany({
      where: { patientProfileId: patient.id },
      include: {
        doctor: { include: { auth: true } },
        template: true,
        appointment: true,
      },
    });
  }
}
