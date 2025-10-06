import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Drug, DrugDocument } from './schemas/drug.schema';

@Injectable()
export class DrugCatalogService {
  constructor(
    @InjectModel(Drug.name) private readonly drugModel: Model<DrugDocument>,
  ) {}

  async search(
    query: string,
    limit = 10,
    skip = 0,
  ): Promise<{ results: any[]; total: number; skip: number; limit: number }> {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const safeSkip = Math.max(0, Number(skip) || 0);

    const textQuery: FilterQuery<DrugDocument> = query
      ? { $text: { $search: query } }
      : {};

    const [results, total] = await Promise.all([
      this.drugModel
        .find(textQuery, query ? { score: { $meta: 'textScore' } } : undefined)
        .sort(query ? { score: { $meta: 'textScore' } } : undefined)
        .skip(safeSkip)
        .limit(safeLimit)
        .lean(),
      this.drugModel.countDocuments(textQuery),
    ]);

    return { results, total, skip: safeSkip, limit: safeLimit };
  }

  async searchPartial(
    query: string,
    limit = 10,
    skip = 0,
  ): Promise<{ results: any[]; total: number; skip: number; limit: number }> {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const safeSkip = Math.max(0, Number(skip) || 0);

    const orConditions: FilterQuery<DrugDocument>[] = [
      { 'openfda.brand_name': new RegExp(query, 'i') },
      { 'openfda.generic_name': new RegExp(query, 'i') },
      { 'openfda.substance_name': new RegExp(query, 'i') },
      { 'openfda.manufacturer_name': new RegExp(query, 'i') },
      { 'openfda.route': new RegExp(query, 'i') },
      { 'openfda.dosage_form': new RegExp(query, 'i') },
      { indications_and_usage: new RegExp(query, 'i') },
      { dosage_and_administration: new RegExp(query, 'i') },
      { warnings: new RegExp(query, 'i') },
      { contraindications: new RegExp(query, 'i') },
    ];

    const [results, total] = await Promise.all([
      this.drugModel
        .find({ $or: orConditions })
        .skip(safeSkip)
        .limit(safeLimit)
        .lean(),
      this.drugModel.countDocuments({ $or: orConditions }),
    ]);

    return { results, total, skip: safeSkip, limit: safeLimit };
  }
}
