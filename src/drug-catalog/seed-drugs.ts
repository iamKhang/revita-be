import { connect, connection, Types } from 'mongoose';
import { DrugSchema } from './schemas/drug.schema';
import * as fs from 'fs';
import * as path from 'path';

type RawDrug = {
  id?: string;
  set_id?: string;
  openfda?: {
    brand_name?: string | null;
    generic_name?: string | null;
    route?: string | null;
    dosage_form?: string | null;
    manufacturer_name?: string | null;
    product_ndc?: string | null;
    application_number?: string | null;
    substance_name?: string | null;
  };
  brand_name?: string | null;
  generic_name?: string | null;
  route?: string | null;
  dosage_form?: string | null;
  manufacturer_name?: string | null;
  product_ndc?: string | null;
  application_number?: string | null;
  substance_name?: string | null;
  indications_and_usage?: string | null;
  dosage_and_administration?: string | null;
  warnings?: string | null;
  contraindications?: string | null;
  adverse_reactions?: string | null;
};

async function run() {
  const uri =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/revita-drug';
  await connect(uri);

  const DrugModel = connection.model('Drug', DrugSchema, 'drugs');

  const filePath = process.env.DRUGS_JSON_PATH;
  const dirPath = process.env.DRUGS_DIR;

  const filesToLoad: string[] = [];
  if (dirPath) {
    const absDir = path.resolve(dirPath);
    const entries = fs.readdirSync(absDir).filter((f) => f.endsWith('.json'));
    filesToLoad.push(...entries.map((f) => path.join(absDir, f)));
  } else if (filePath) {
    filesToLoad.push(path.resolve(filePath));
  } else {
    // default: prisma/Data/drugs.json OR prisma/Data/drug-001..013.json
    const defaultDir = path.resolve('prisma/Data/drugs');
    const patternFiles = Array.from({ length: 13 }, (_, i) => {
      const n = String(i + 1).padStart(3, '0');
      return path.join(defaultDir, `drug-${n}.json`);
    }).filter((p) => fs.existsSync(p));
    if (patternFiles.length > 0) {
      filesToLoad.push(...patternFiles);
    } else {
      const single = path.join(defaultDir, 'drugs.json');
      if (fs.existsSync(single)) filesToLoad.push(single);
    }
  }

  if (filesToLoad.length === 0) {
    console.error(
      'No input JSON files found. Set DRUGS_DIR or DRUGS_JSON_PATH.',
    );
    process.exit(1);
  }

  for (const file of filesToLoad) {
    console.log(`Seeding ${file}`);
    const rawText = fs.readFileSync(file, 'utf-8');
    const parsed: unknown = JSON.parse(rawText);
    if (!Array.isArray(parsed)) {
      console.warn(`Skip ${file}: root is not an array`);
      continue;
    }

    const bulkOps = parsed.map((raw: RawDrug) => {
      const doc = {
        id: raw.set_id || raw.id || null,
        openfda: {
          brand_name: raw.openfda?.brand_name ?? raw.brand_name ?? null,
          generic_name: raw.openfda?.generic_name ?? raw.generic_name ?? null,
          route: raw.openfda?.route ?? raw.route ?? null,
          dosage_form: raw.openfda?.dosage_form ?? raw.dosage_form ?? null,
          manufacturer_name:
            raw.openfda?.manufacturer_name ?? raw.manufacturer_name ?? null,
          product_ndc: raw.openfda?.product_ndc ?? raw.product_ndc ?? null,
          application_number:
            raw.openfda?.application_number ?? raw.application_number ?? null,
          substance_name:
            raw.openfda?.substance_name ?? raw.substance_name ?? null,
        },
        indications_and_usage: raw.indications_and_usage ?? null,
        dosage_and_administration: raw.dosage_and_administration ?? null,
        warnings: raw.warnings ?? null,
        contraindications: raw.contraindications ?? null,
        adverse_reactions: raw.adverse_reactions ?? null,
      };

      const ndc = doc.openfda.product_ndc;
      if (ndc) {
        return {
          updateOne: {
            filter: { 'openfda.product_ndc': ndc },
            update: { $set: doc },
            upsert: true,
          },
        } as const;
      }
      if (doc.id) {
        return {
          updateOne: {
            filter: { id: doc.id },
            update: { $set: doc },
            upsert: true,
          },
        } as const;
      }
      const _id = new Types.ObjectId();
      return {
        insertOne: {
          document: { _id, ...doc },
        },
      } as const;
    });

    if (bulkOps.length > 0) {
      await DrugModel.bulkWrite(bulkOps, { ordered: false });
    }
  }

  await connection.close();
  console.log('Drug seed completed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
