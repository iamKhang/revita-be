import { ApiProperty } from '@nestjs/swagger';

export class PatientMedicalSummaryResponseDto {
  @ApiProperty({
    description: 'Tóm tắt toàn bộ thông tin y tế của bệnh nhân dưới dạng chuỗi',
    example: `=== THÔNG TIN BỆNH NHÂN ===
Tên: Nguyễn Văn A
Ngày sinh: 01/01/1990
Giới tính: Nam
Địa chỉ: 123 Đường ABC, Quận 1, TP.HCM

=== BỆNH ÁN ===
Bệnh án 1:
- Mã bệnh án: MR-2024-001
- Bác sĩ: BS. Nguyễn Văn B
- Ngày tạo: 15/12/2024
- Trạng thái: COMPLETED
- Nội dung: {"chief_complaint": "Đau đầu", "diagnosis": "Stress", "treatment_plan": "Nghỉ ngơi"}

=== PHIẾU CHỈ ĐỊNH DỊCH VỤ ===
Phiếu chỉ định 1:
- Mã phiếu: P-2024-001
- Bác sĩ: BS. Nguyễn Văn B
- Ngày tạo: 15/12/2024
- Trạng thái: COMPLETED
- Dịch vụ được chỉ định:
  1. Xét nghiệm máu
     - Mã dịch vụ: LAB-001
     - Trạng thái: COMPLETED
     - Kết quả: Hồng cầu bình thường, Bạch cầu tăng nhẹ
     - Bác sĩ thực hiện: BS. Nguyễn Văn C
     - Hoàn thành: 16/12/2024

=== ĐƠN THUỐC ===
Đơn thuốc 1:
- Mã đơn: MP-2024-001
- Bác sĩ: BS. Nguyễn Văn B
- Ngày tạo: 15/12/2024
- Trạng thái: DISPENSED
- Thuốc được kê:
  1. Paracetamol 500mg
     - Hàm lượng: 500mg
     - Dạng bào chế: Viên nén
     - Liều dùng: 1 viên
     - Tần suất: 3 lần/ngày
     - Thời gian: 7 ngày
     - Số lượng: 21 viên
     - Hướng dẫn: Uống sau khi ăn`,
  })
  summary: string;

  @ApiProperty({
    description: 'ID của hồ sơ bệnh nhân',
    example: 'patient-profile-uuid-123',
  })
  patientProfileId: string;

  @ApiProperty({
    description: 'Tên bệnh nhân',
    example: 'Nguyễn Văn A',
  })
  patientName: string;

  @ApiProperty({
    description: 'Thời gian tạo tóm tắt',
    example: '2024-12-15T10:30:00.000Z',
  })
  generatedAt: string;
}
