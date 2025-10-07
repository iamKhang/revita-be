import { Injectable } from '@nestjs/common';

export enum EntityType {
  PATIENT = 'PAT',
  DOCTOR = 'DOC',
  ADMIN = 'ADM',
  PATIENT_PROFILE = 'PP',
  PATIENT_PROFILE_INDEPENDENT = 'PPI',
  MEDICAL_RECORD = 'MR',
  APPOINTMENT = 'APPT',
  PRESCRIPTION = 'PRESC',
  CLINIC_ROOM = 'ROOM',
  BOOTH = 'BOOTH',
}

@Injectable()
export class CodeGeneratorService {
  /**
   * Tạo mã profile dựa trên thông tin bệnh nhân
   * Format: PP{YYMMDD}{HHMMSS}{GENDER}{LASTNAME_INITIAL}
   *
   * Ví dụ:
   * - PP250107143052M1 (PP + 25/01/07 + 14:30:52 + M + 1)
   * - PP250107143052F2 (PP + 25/01/07 + 14:30:52 + F + 2)
   */
  generateProfileCode(
    name: string,
    dateOfBirth: Date,
    gender: string,
    isIndependent: boolean = false,
  ): string {
    const now = new Date();

    // Lấy thông tin thời gian hiện tại
    const year = now.getFullYear().toString().slice(-2); // 2 chữ số cuối của năm
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');

    // Xác định giới tính
    const genderCode = this.getGenderCode(gender);

    // Lấy chữ cái đầu của họ
    const lastNameInitial = this.getLastNameInitial(name);

    // Prefix cho loại profile
    const prefix = isIndependent ? 'PPI' : 'PP';

    // Tạo mã profile
    const profileCode = `${prefix}${year}${month}${day}${hour}${minute}${second}${genderCode}${lastNameInitial}`;

    return profileCode;
  }

  /**
   * Tạo mã đơn giản cho bất kỳ entity nào (fallback)
   * Format: {PREFIX}{timestamp}
   */
  generateSimpleCode(entityType: EntityType): string {
    return `${entityType}${Date.now()}`;
  }

  /**
   * Tạo mã profile đơn giản (fallback)
   * Format: PP{timestamp} hoặc PPI{timestamp}
   */
  generateSimpleProfileCode(isIndependent: boolean = false): string {
    const prefix = isIndependent ? 'PPI' : 'PP';
    return `${prefix}${Date.now()}`;
  }

  /**
   * Tạo mã Patient dựa trên thông tin
   * Format: PAT{YYMMDD}{HHMMSS}{GENDER}{LASTNAME_INITIAL}
   */
  generatePatientCode(name: string, dateOfBirth: Date, gender: string): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');

    const genderCode = this.getGenderCode(gender);
    const lastNameInitial = this.getLastNameInitial(name);

    return `PAT${year}${month}${day}${hour}${minute}${second}${genderCode}${lastNameInitial}`;
  }

  /**
   * Tạo mã Doctor dựa trên thông tin
   * Format: DOC{YYMMDD}{HHMMSS}{SPECIALTY_INITIAL}{LASTNAME_INITIAL}
   */
  generateDoctorCode(name: string, specialty?: string): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');

    const specialtyCode = specialty ? this.getSpecialtyCode(specialty) : '';
    const lastNameInitial = this.getLastNameInitial(name);

    return `DOC${year}${month}${day}${hour}${minute}${second}${specialtyCode}${lastNameInitial}`;
  }

  /**
   * Tạo mã Admin
   * Format: ADM{YYMMDD}{HHMMSS}{LASTNAME_INITIAL}
   */
  generateAdminCode(name: string): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');

    const lastNameInitial = this.getLastNameInitial(name);

    return `ADM${year}${month}${day}${hour}${minute}${second}${lastNameInitial}`;
  }

  /**
   * Tạo mã Medical Record
   * Format: MR{YYMMDD}{HHMMSS}{DOCTOR_INITIAL}{PATIENT_INITIAL}
   */
  generateMedicalRecordCode(doctorName: string, patientName: string): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');

    const doctorInitial = this.getLastNameInitial(doctorName);
    const patientInitial = this.getLastNameInitial(patientName);

    return `MR${year}${month}${day}${hour}${minute}${second}${doctorInitial}${patientInitial}`;
  }

  /**
   * Tạo mã Appointment
   * Format: APPT{YYMMDD}{HHMMSS}{DOCTOR_INITIAL}{PATIENT_INITIAL}
   */
  generateAppointmentCode(doctorName: string, patientName: string): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');

    const doctorInitial = this.getLastNameInitial(doctorName);
    const patientInitial = this.getLastNameInitial(patientName);

    return `APPT${year}${month}${day}${hour}${minute}${second}${doctorInitial}${patientInitial}`;
  }

  /**
   * Tạo mã Prescription
   * Format: PRESC{YYMMDD}{HHMMSS}{DOCTOR_INITIAL}{PATIENT_INITIAL}
   */
  generatePrescriptionCode(doctorName: string, patientName: string): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');

    const doctorInitial = this.getLastNameInitial(doctorName);
    const patientInitial = this.getLastNameInitial(patientName);

    return `PRESC${year}${month}${day}${hour}${minute}${second}${doctorInitial}${patientInitial}`;
  }

  /**
   * Lấy mã giới tính
   */
  private getGenderCode(gender: string): string {
    const genderLower = gender.toLowerCase();
    if (
      genderLower.includes('nam') ||
      genderLower.includes('male') ||
      genderLower.includes('m')
    ) {
      return 'M';
    } else if (
      genderLower.includes('nữ') ||
      genderLower.includes('female') ||
      genderLower.includes('f')
    ) {
      return 'F';
    } else {
      return 'O'; // Other
    }
  }

  /**
   * Lấy chữ cái đầu của họ (từ cuối lên)
   */
  private getLastNameInitial(name: string): string {
    if (!name || name.trim().length === 0) {
      return 'X'; // Default
    }

    // Loại bỏ khoảng trắng thừa và tách thành mảng
    const nameParts = name.trim().split(/\s+/);

    if (nameParts.length === 0) {
      return 'X';
    }

    // Lấy họ (phần đầu tiên)
    const lastName = nameParts[0];

    // Lấy chữ cái đầu và chuyển thành số (A=1, B=2, ..., Z=26)
    const firstChar = lastName.charAt(0).toUpperCase();
    const charCode = firstChar.charCodeAt(0) - 64; // A=65, nên A=1

    // Nếu không phải chữ cái, trả về X
    if (charCode < 1 || charCode > 26) {
      return 'X';
    }

    return charCode.toString();
  }

  /**
   * Tạo mã profile với thông tin bổ sung
   * Format: PP{YYMMDD}{HHMMSS}{GENDER}{LASTNAME_INITIAL}{AGE_GROUP}
   */
  generateAdvancedProfileCode(
    name: string,
    dateOfBirth: Date,
    gender: string,
    isIndependent: boolean = false,
  ): string {
    const now = new Date();

    // Lấy thông tin thời gian hiện tại
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');

    // Xác định giới tính
    const genderCode = this.getGenderCode(gender);

    // Lấy chữ cái đầu của họ
    const lastNameInitial = this.getLastNameInitial(name);

    // Xác định nhóm tuổi
    const ageGroup = this.getAgeGroup(dateOfBirth);

    // Prefix cho loại profile
    const prefix = isIndependent ? 'PPI' : 'PP';

    // Tạo mã profile
    const profileCode = `${prefix}${year}${month}${day}${hour}${minute}${second}${genderCode}${lastNameInitial}${ageGroup}`;

    return profileCode;
  }

  /**
   * Xác định nhóm tuổi
   */
  private getAgeGroup(dateOfBirth: Date): string {
    const now = new Date();
    const age = now.getFullYear() - dateOfBirth.getFullYear();

    if (age < 18) {
      return '1'; // Trẻ em/Thiếu niên
    } else if (age < 30) {
      return '2'; // Thanh niên
    } else if (age < 50) {
      return '3'; // Trung niên
    } else if (age < 65) {
      return '4'; // Trung cao tuổi
    } else {
      return '5'; // Cao tuổi
    }
  }

  /**
   * Lấy mã chuyên khoa
   */
  private getSpecialtyCode(specialty: string): string {
    const specialtyMap: Record<string, string> = {
      'tim mạch': 'TM',
      'thần kinh': 'TK',
      'nội khoa': 'NK',
      'ngoại khoa': 'NK',
      'sản phụ khoa': 'SG',
      'nhi khoa': 'NH',
      mắt: 'MT',
      'tai mũi họng': 'TMH',
      'da liễu': 'DL',
      'xương khớp': 'XK',
      'tâm thần': 'TT',
      'ung bướu': 'UB',
      'hồi sức cấp cứu': 'HS',
      'gây mê hồi sức': 'GM',
      'chẩn đoán hình ảnh': 'CD',
      'xét nghiệm': 'XN',
      dược: 'DC',
    };

    const specialtyLower = specialty.toLowerCase();
    for (const [key, code] of Object.entries(specialtyMap)) {
      if (specialtyLower.includes(key)) {
        return code;
      }
    }

    // Fallback: lấy 2 chữ cái đầu
    return specialty.substring(0, 2).toUpperCase();
  }

  /**
   * Validate mã profile
   */
  validateProfileCode(code: string): boolean {
    // Kiểm tra format cơ bản
    const basicPattern = /^(PP|PPI)\d{12}[MFO]\d{1,2}$/;
    return basicPattern.test(code);
  }

  /**
   * Parse thông tin từ mã profile
   */
  parseProfileCode(code: string): {
    type: 'PP' | 'PPI';
    date: Date;
    gender: 'M' | 'F' | 'O';
    lastNameInitial: number;
    ageGroup?: number;
  } | null {
    if (!this.validateProfileCode(code)) {
      return null;
    }

    const type = code.startsWith('PPI') ? 'PPI' : 'PP';
    const year = 2000 + parseInt(code.slice(2, 4));
    const month = parseInt(code.slice(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(code.slice(6, 8));
    const hour = parseInt(code.slice(8, 10));
    const minute = parseInt(code.slice(10, 12));
    const second = parseInt(code.slice(12, 14));

    const date = new Date(year, month, day, hour, minute, second);
    const gender = code.slice(14, 15) as 'M' | 'F' | 'O';
    const lastNameInitial = parseInt(code.slice(15, 16));
    const ageGroup =
      code.length > 16 ? parseInt(code.slice(16, 17)) : undefined;

    return {
      type,
      date,
      gender,
      lastNameInitial,
      ageGroup,
    };
  }

  /**
   * Tạo mã Clinic Room
   * Format: ROOM{SPECIALTY_CODE}{SEQUENCE_NUMBER}
   * 
   * Ví dụ:
   * - ROOMCARD001 (ROOM + CARD + 001)
   * - ROOMDERM002 (ROOM + DERM + 002)
   */
  generateClinicRoomCode(specialtyCode: string, existingCount: number = 0): string {
    // Lấy 4 ký tự đầu của specialty code và chuyển thành uppercase
    const specialtyPrefix = specialtyCode.substring(0, 4).toUpperCase();
    
    // Tạo sequence number (3 chữ số, bắt đầu từ 001)
    const sequenceNumber = (existingCount + 1).toString().padStart(3, '0');
    
    return `ROOM${specialtyPrefix}${sequenceNumber}`;
  }

  /**
   * Tạo mã Booth
   * Format: BOOTH{ROOM_CODE}{SEQUENCE_NUMBER}
   * 
   * Ví dụ:
   * - BOOTHCARD001001 (BOOTH + ROOMCARD001 + 001)
   * - BOOTHCARD001002 (BOOTH + ROOMCARD001 + 002)
   */
  generateBoothCode(roomCode: string, existingCount: number = 0): string {
    // Tạo sequence number (3 chữ số, bắt đầu từ 001)
    const sequenceNumber = (existingCount + 1).toString().padStart(3, '0');
    
    return `BOOTH${roomCode}${sequenceNumber}`;
  }

  /**
   * Tạo mã đơn giản cho Clinic Room (fallback)
   * Format: ROOM{timestamp}
   */
  generateSimpleClinicRoomCode(): string {
    return `ROOM${Date.now()}`;
  }

  /**
   * Tạo mã đơn giản cho Booth (fallback)
   * Format: BOOTH{timestamp}
   */
  generateSimpleBoothCode(): string {
    return `BOOTH${Date.now()}`;
  }
}
