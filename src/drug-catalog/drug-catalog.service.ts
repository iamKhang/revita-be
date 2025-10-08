import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Drug, DrugDocument } from './schemas/drug.schema';

@Injectable()
export class DrugCatalogService {
  constructor(
    @InjectModel(Drug.name) private readonly drugModel: Model<DrugDocument>,
  ) {}

  // Search tương đối theo các trường openfda (chính xác hơn)
  async search(
    query: string,
    limit = 10,
    skip = 0,
  ): Promise<{ results: any[]; total: number; skip: number; limit: number }> {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const safeSkip = Math.max(0, Number(skip) || 0);

    // Tạo regex pattern để search tương đối theo các trường openfda
    const regexPattern = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i',
    );

    const openfdaConditions: FilterQuery<DrugDocument>[] = [
      { 'openfda.brand_name': regexPattern },
      { 'openfda.generic_name': regexPattern },
      { 'openfda.substance_name': regexPattern },
      { 'openfda.manufacturer_name': regexPattern },
      { 'openfda.route': regexPattern },
      { 'openfda.dosage_form': regexPattern },
    ];

    const searchQuery: FilterQuery<DrugDocument> = query
      ? { $or: openfdaConditions }
      : {};

    const [results, total] = await Promise.all([
      this.drugModel.find(searchQuery).skip(safeSkip).limit(safeLimit).lean(),
      this.drugModel.countDocuments(searchQuery),
    ]);

    return { results, total, skip: safeSkip, limit: safeLimit };
  }

  // Full text search tương đối (search trong tất cả các trường có text index)
  async searchPartial(
    query: string,
    limit = 10,
    skip = 0,
  ): Promise<{ results: any[]; total: number; skip: number; limit: number }> {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const safeSkip = Math.max(0, Number(skip) || 0);

    // Sử dụng MongoDB text search với text index đã được tạo trong schema
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
}
