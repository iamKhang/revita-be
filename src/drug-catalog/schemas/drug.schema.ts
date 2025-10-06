import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DrugDocument = HydratedDocument<Drug>;

@Schema({ collection: 'drugs', timestamps: true })
export class Drug {
  @Prop({ type: String, index: true })
  id: string; // set_id from FDA

  @Prop({
    type: {
      brand_name: { type: String, index: true },
      generic_name: { type: String, index: true },
      route: { type: String, index: true },
      dosage_form: { type: String, index: true },
      manufacturer_name: { type: String, index: true },
      product_ndc: { type: String, index: true },
      application_number: { type: String, index: true },
      substance_name: { type: String, index: true },
    },
    _id: false,
  })
  openfda: {
    brand_name?: string | null;
    generic_name?: string | null;
    route?: string | null;
    dosage_form?: string | null;
    manufacturer_name?: string | null;
    product_ndc?: string | null;
    application_number?: string | null;
    substance_name?: string | null;
  };

  @Prop({ type: String })
  indications_and_usage: string | null;

  @Prop({ type: String })
  dosage_and_administration: string | null;

  @Prop({ type: String })
  warnings: string | null;

  @Prop({ type: String })
  contraindications: string | null;

  @Prop({ type: String })
  adverse_reactions: string | null;
}

export const DrugSchema = SchemaFactory.createForClass(Drug);

DrugSchema.index({
  'openfda.brand_name': 'text',
  'openfda.generic_name': 'text',
  'openfda.substance_name': 'text',
  'openfda.manufacturer_name': 'text',
  'openfda.route': 'text',
  'openfda.dosage_form': 'text',
  indications_and_usage: 'text',
  dosage_and_administration: 'text',
  warnings: 'text',
  contraindications: 'text',
});
