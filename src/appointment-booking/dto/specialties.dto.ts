export class SpecialtyDto {
  specialtyId: string;
  specialtyCode: string;
  name: string;
  description?: string;
  imgUrl?: string;
}

export class SpecialtiesResponseDto {
  specialties: SpecialtyDto[];
}
