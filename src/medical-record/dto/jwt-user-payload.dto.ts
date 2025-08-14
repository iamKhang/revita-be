export interface JwtUserPayload {
  id: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  doctor?: {
    id: string;
    doctorCode: string;
  };
  patient?: {
    id: string;
    patientCode: string;
  };
  receptionist?: {
    id: string;
  };
  admin?: {
    id: string;
  };

  // Thêm các trường khác nếu cần
}
