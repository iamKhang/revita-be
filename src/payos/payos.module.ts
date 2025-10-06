import { Module } from '@nestjs/common';
import { PayOsService } from './payos.service';

@Module({
  providers: [PayOsService],
  exports: [PayOsService],
})
export class PayOsModule {}
