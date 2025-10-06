import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Drug, DrugSchema } from './schemas/drug.schema';
import { DrugCatalogService } from '../drug-catalog/drug-catalog.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Drug.name, schema: DrugSchema }]),
  ],
  providers: [DrugCatalogService],
  exports: [DrugCatalogService],
})
export class DrugCatalogModule {}
