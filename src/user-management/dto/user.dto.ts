export class UserDto {
  id: string;
  name: string;
  dateOfBirth: Date;
  gender: string;
  avatar?: string | null;
  address: string;
  citizenId?: string | null;
  role: string;
  isActive: boolean;
}

export class CreateUserDto {
  name: string;
  dateOfBirth: Date;
  gender: string;
  avatar?: string;
  address: string;
  citizenId?: string;
  role: string;
  password: string;
  // Thêm các trường riêng cho từng loại user nếu cần
  clinicId?: string; // cho Doctor, Receptionist, ClinicAdmin
}

export class UpdateUserDto {
  name?: string;
  dateOfBirth?: Date;
  gender?: string;
  avatar?: string;
  address?: string;
  citizenId?: string;
  role?: string;
  isActive?: boolean;
  // Thêm các trường riêng cho từng loại user nếu cần
  clinicId?: string;
}
