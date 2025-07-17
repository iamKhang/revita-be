export interface JwtUserPayload {
  id: string;
  role: string;
  doctor?: {
    id: string;
  };
  patient?: {
    id: string;
  };
  // Thêm các trường khác nếu cần
}
