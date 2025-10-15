export interface UserContext {
  id: string; // This is the Auth.id
  sub: string;
  role: string;
  email?: string;
  phone?: string;
  patient?: string;
  doctor?: string;
  technician?: string;
  admin?: string;
  receptionist?: string;
}
