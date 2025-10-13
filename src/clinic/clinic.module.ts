import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SpecialtyController } from './specialty/specialty.controller';
import { SpecialtyService } from './specialty/specialty.service';
import { ClinicRoomController } from './clinic-room/clinic-room.controller';
import { ClinicRoomService } from './clinic-room/clinic-room.service';
import { BoothController } from './booth/booth.controller';
import { BoothService } from './booth/booth.service';

@Module({
  controllers: [SpecialtyController, ClinicRoomController, BoothController],
  providers: [SpecialtyService, ClinicRoomService, BoothService, PrismaService],
  exports: [SpecialtyService, ClinicRoomService, BoothService],
})
export class ClinicModule {}
