import { Module } from '@nestjs/common';
import { ReceptionistController } from './receptionist.controller';
import { ReceptionistService } from './receptionist.service';

@Module({
  controllers: [ReceptionistController],
  providers: [ReceptionistService],
})
export class ReceptionistModule {}
