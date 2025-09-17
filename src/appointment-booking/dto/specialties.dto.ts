export class SpecialtyDto {
  specialtyId: string;
  specialtyCode: string;
  name: string;
}

export class SpecialtiesResponseDto {
  specialties: SpecialtyDto[];
}
