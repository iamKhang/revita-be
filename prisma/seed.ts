import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 2.1. Tạo danh sách các chuyên khoa (Specialty)
  const specialtyNames = [
    'Nội tổng quát',
    'Răng hàm mặt',
    'Mắt',
    'Ngoại khoa',
    'Ung bướu',
    'Truyền nhiễm',
    'Nhi khoa',
    'Phụ khoa',
    'Da liễu',
    'Sản khoa',
    'Tai mũi họng',
    'Phục hồi chức năng',
    'Bỏng',
    'Huyết học/truyền máu',
    'Tâm thần',
    'Ngoại trú chung',
  ];

  // Tạo specialty và lưu lại id theo tên
  const specialtyMap: Record<string, { id: string; name: string }> = {};
  for (const name of specialtyNames) {
    const s = await prisma.specialty.create({
      data: {
        name,
        specialtyCode: name.toUpperCase().replace(/\s+/g, '_'),
      },
    });
    specialtyMap[name] = { id: s.id, name };
  }

  // 2.2. Tạo danh sách template (mapping specialtyId, templateCode, name, fields)
  const templates = [
    // Nội khoa
    {
      templateCode: 'NOI_KHOA',
      name: 'Nội khoa',
      specialtyName: 'Nội tổng quát',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Triệu chứng chính',
            type: 'string',
            required: true,
          },
          { name: 'hpi', label: 'Diễn tiến bệnh', type: 'text' },
          { name: 'pmh', label: 'Tiền sử bệnh', type: 'text' },
          { name: 'psh', label: 'Tiền sử phẫu thuật', type: 'text' },
          { name: 'social_history', label: 'Tiền sử xã hội', type: 'text' },
          { name: 'family_history', label: 'Tiền sử gia đình', type: 'text' },
          { name: 'medications', label: 'Thuốc dùng', type: 'text' },
          { name: 'allergies', label: 'Dị ứng', type: 'text' },
          { name: 'ros', label: 'Review of Systems', type: 'text' },
          {
            name: 'vital_signs',
            label: 'Dấu hiệu sinh tồn',
            type: 'object',
            properties: {
              temp: { type: 'number' },
              bp: { type: 'string' },
              hr: { type: 'number' },
              rr: { type: 'number' },
              o2_sat: { type: 'number' },
              pain_score: { type: 'number' },
            },
          },
          { name: 'physical_exam', label: 'Khám thực thể', type: 'text' },
          { name: 'lab_results', label: 'Xét nghiệm / CLS', type: 'text' },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán',
            type: 'string',
            required: true,
          },
          {
            name: 'treatment_plan',
            label: 'Kế hoạch điều trị',
            type: 'text',
            required: true,
          },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
        ],
      },
    },
    // Răng hàm mặt
    {
      templateCode: 'RANG_HAM_MAT',
      name: 'Răng hàm mặt',
      specialtyName: 'Răng hàm mặt',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do khám',
            type: 'string',
            required: true,
          },
          { name: 'medical_history', label: 'Tiền sử bệnh', type: 'text' },
          { name: 'dental_history', label: 'Tiền sử nha khoa', type: 'text' },
          { name: 'tooth_number', label: 'Số hiệu răng', type: 'string' },
          { name: 'tooth_condition', label: 'Tình trạng răng', type: 'string' },
          { name: 'gum_condition', label: 'Tình trạng nướu', type: 'string' },
          { name: 'occlusion', label: 'Khớp cắn', type: 'string' },
          { name: 'medications', label: 'Thuốc dùng', type: 'text' },
          { name: 'xray_results', label: 'X‑quang', type: 'text' },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán',
            type: 'string',
            required: true,
          },
          {
            name: 'treatment_plan',
            label: 'Kế hoạch điều trị',
            type: 'text',
            required: true,
          },
          { name: 'procedures', label: 'Thủ thuật thực hiện', type: 'text' },
          { name: 'consent', label: 'Consent', type: 'text' },
          {
            name: 'procedure_date',
            label: 'Ngày thực hiện thủ thuật / điều trị',
            type: 'date',
          },
          {
            name: 'attachments',
            label: 'Tệp đính kèm (chẩn đoán hình ảnh, kết quả xét nghiệm...)',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                filetype: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
        ],
      },
    },
    // Mắt
    {
      templateCode: 'MAT',
      name: 'Mắt',
      specialtyName: 'Mắt',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do khám',
            type: 'string',
            required: true,
          },
          { name: 'medical_history', label: 'Tiền sử bệnh', type: 'text' },
          { name: 'ocular_history', label: 'Tiền sử mắt', type: 'text' },
          { name: 'visual_acuity', label: 'Thị lực (OD/OS)', type: 'string' },
          { name: 'refraction', label: 'Khúc xạ', type: 'string' },
          { name: 'intraocular_pressure', label: 'IOP', type: 'number' },
          { name: 'anterior_segment', label: 'Mắt trước', type: 'text' },
          { name: 'medications', label: 'Thuốc dùng', type: 'text' },
          { name: 'posterior_segment', label: 'Mắt sau', type: 'text' },
          { name: 'imaging_results', label: 'Hình ảnh học', type: 'text' },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán',
            type: 'string',
            required: true,
          },
          {
            name: 'treatment_plan',
            label: 'Kế hoạch điều trị',
            type: 'text',
            required: true,
          },
          { name: 'follow_up', label: 'Tái khám', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
          {
            name: 'attachments',
            label: 'Tệp đính kèm (chẩn đoán hình ảnh, kết quả xét nghiệm...)',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                filetype: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
        ],
      },
    },
    // Ngoại khoa
    {
      templateCode: 'NGOAI_KHOA',
      name: 'Ngoại khoa',
      specialtyName: 'Ngoại khoa',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do nhập viện',
            type: 'string',
            required: true,
          },
          {
            name: 'history_of_present_illness',
            label: 'Diễn tiến bệnh',
            type: 'text',
          },
          {
            name: 'trauma_history',
            label: 'Tiền sử chấn thương/phẫu thuật',
            type: 'text',
          },
          {
            name: 'medical_history',
            label: 'Tiền sử bệnh nội khoa',
            type: 'text',
          },
          {
            name: 'vital_signs',
            label: 'Dấu hiệu sinh tồn',
            type: 'object',
            properties: {
              temp: { type: 'number' },
              bp: { type: 'string' },
              hr: { type: 'number' },
              rr: { type: 'number' },
            },
          },
          { name: 'medications', label: 'Thuốc dùng', type: 'text' },
          {
            name: 'procedure_date',
            label: 'Ngày thực hiện thủ thuật / điều trị',
            type: 'date',
          },
          { name: 'physical_exam', label: 'Khám lâm sàng', type: 'text' },
          {
            name: 'surgical_assessment',
            label: 'Đánh giá phẫu thuật',
            type: 'text',
          },
          {
            name: 'lab_results',
            label: 'Xét nghiệm cận lâm sàng',
            type: 'text',
          },
          { name: 'imaging', label: 'Chẩn đoán hình ảnh', type: 'text' },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán',
            type: 'string',
            required: true,
          },
          { name: 'surgery_plan', label: 'Kế hoạch mổ', type: 'text' },
          {
            name: 'treatment_plan',
            label: 'Điều trị nội khoa kèm theo',
            type: 'text',
          },
          { name: 'post_op_care', label: 'Chăm sóc hậu phẫu', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
        ],
      },
    },
    // Ung bướu
    {
      templateCode: 'UNG_BUOU',
      name: 'Ung bướu',
      specialtyName: 'Ung bướu',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Triệu chứng chính',
            type: 'string',
            required: true,
          },
          { name: 'tumor_location', label: 'Vị trí khối u', type: 'string' },
          { name: 'tumor_size', label: 'Kích thước u', type: 'string' },
          {
            name: 'clinical_stage',
            label: 'Giai đoạn lâm sàng',
            type: 'string',
          },
          { name: 'histopathology', label: 'Giải phẫu bệnh', type: 'text' },
          { name: 'medications', label: 'Thuốc dùng', type: 'text' },
          { name: 'immuno_results', label: 'Miễn dịch mô học', type: 'text' },
          {
            name: 'lab_results',
            label: 'Xét nghiệm (máu, marker)',
            type: 'text',
          },
          {
            name: 'imaging',
            label: 'Chẩn đoán hình ảnh (CT, MRI)',
            type: 'text',
          },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán ung thư',
            type: 'string',
            required: true,
          },
          {
            name: 'tnm_classification',
            label: 'Phân loại TNM',
            type: 'string',
          },
          { name: 'treatment_plan', label: 'Kế hoạch điều trị', type: 'text' },
          {
            name: 'treatment_type',
            label: 'Loại điều trị (phẫu thuật, hóa xạ)',
            type: 'string',
          },
          { name: 'follow_up', label: 'Theo dõi tái khám', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
          {
            name: 'attachments',
            label: 'Tệp đính kèm (chẩn đoán hình ảnh, kết quả xét nghiệm...)',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                filetype: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
        ],
      },
    },
    // Truyền nhiễm
    {
      templateCode: 'TRUYEN_NHIEM',
      name: 'Truyền nhiễm',
      specialtyName: 'Truyền nhiễm',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do vào viện',
            type: 'string',
            required: true,
          },
          { name: 'onset_date', label: 'Ngày khởi phát', type: 'date' },
          {
            name: 'epidemiological_history',
            label: 'Tiền sử dịch tễ',
            type: 'text',
          },
          { name: 'medical_history', label: 'Tiền sử bệnh lý', type: 'text' },
          { name: 'medications', label: 'Thuốc dùng', type: 'text' },
          {
            name: 'contact_history',
            label: 'Tiếp xúc với người bệnh',
            type: 'text',
          },
          {
            name: 'vital_signs',
            label: 'Dấu hiệu sinh tồn',
            type: 'object',
            properties: {
              temp: { type: 'number' },
              bp: { type: 'string' },
              hr: { type: 'number' },
              rr: { type: 'number' },
            },
          },
          { name: 'physical_exam', label: 'Khám thực thể', type: 'text' },
          {
            name: 'lab_results',
            label: 'Cận lâm sàng (HIV, vi sinh,...)',
            type: 'text',
          },
          {
            name: 'infectious_diagnosis',
            label: 'Chẩn đoán truyền nhiễm',
            type: 'string',
            required: true,
          },
          {
            name: 'isolation_required',
            label: 'Yêu cầu cách ly',
            type: 'boolean',
          },
          {
            name: 'treatment_plan',
            label: 'Điều trị (kháng sinh, theo phác đồ)',
            type: 'text',
          },
          {
            name: 'notification_status',
            label: 'Khai báo dịch tễ',
            type: 'string',
          },
          { name: 'follow_up', label: 'Tái khám theo dõi', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
          {
            name: 'attachments',
            label: 'Tệp đính kèm (chẩn đoán hình ảnh, kết quả xét nghiệm...)',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                filetype: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
        ],
      },
    },
    // Nhi khoa
    {
      templateCode: 'NHI_KHOA',
      name: 'Nhi khoa',
      specialtyName: 'Nhi khoa',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do nhập viện',
            type: 'string',
            required: true,
          },
          {
            name: 'onset_date',
            label: 'Ngày khởi phát triệu chứng',
            type: 'date',
          },
          {
            name: 'birth_history',
            label: 'Tiền sử sinh (đủ/tháng, mổ/thường, cân nặng sinh)',
            type: 'text',
          },
          { name: 'allergies', label: 'Dị ứng', type: 'text' },
          { name: 'immunization_history', label: 'Tiêm chủng', type: 'text' },
          { name: 'nutrition_history', label: 'Dinh dưỡng', type: 'text' },
          { name: 'growth_chart', label: 'Biểu đồ tăng trưởng', type: 'text' },
          { name: 'family_history', label: 'Tiền sử gia đình', type: 'text' },
          {
            name: 'vital_signs',
            label: 'Dấu hiệu sinh tồn',
            type: 'object',
            properties: {
              temp: { type: 'number' },
              bp: { type: 'string' },
              hr: { type: 'number' },
              rr: { type: 'number' },
              weight: { type: 'number' },
              height: { type: 'number' },
            },
          },
          { name: 'physical_exam', label: 'Khám lâm sàng', type: 'text' },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán',
            type: 'string',
            required: true,
          },
          {
            name: 'treatment_plan',
            label: 'Kế hoạch điều trị',
            type: 'text',
            required: true,
          },
          { name: 'follow_up', label: 'Tái khám', type: 'text' },
          { name: 'notes', label: 'Ghi chú thêm', type: 'text' },
        ],
      },
    },
    // Phụ khoa
    {
      templateCode: 'PHU_KHOA',
      name: 'Phụ khoa',
      specialtyName: 'Phụ khoa',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do khám',
            type: 'string',
            required: true,
          },
          { name: 'menstrual_history', label: 'Kinh nguyệt', type: 'text' },
          { name: 'allergies', label: 'Dị ứng', type: 'text' },
          {
            name: 'obstetric_history',
            label: 'Tiền sử sản khoa (para, gravida, sảy thai,...)',
            type: 'text',
          },
          { name: 'sexual_history', label: 'Tiền sử tình dục', type: 'text' },
          { name: 'vaginal_discharge', label: 'Khí hư', type: 'text' },
          { name: 'pelvic_exam', label: 'Khám phụ khoa', type: 'text' },
          { name: 'ultrasound', label: 'Siêu âm phụ khoa', type: 'text' },
          {
            name: 'lab_results',
            label: 'Xét nghiệm (Pap, nội tiết...)',
            type: 'text',
          },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán',
            type: 'string',
            required: true,
          },
          {
            name: 'treatment_plan',
            label: 'Kế hoạch điều trị',
            type: 'text',
            required: true,
          },
          {
            name: 'contraceptive_advice',
            label: 'Tư vấn tránh thai',
            type: 'text',
          },
          { name: 'follow_up', label: 'Tái khám', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
          {
            name: 'attachments',
            label: 'Tệp đính kèm (chẩn đoán hình ảnh, kết quả xét nghiệm...)',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                filetype: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
        ],
      },
    },
    // Da liễu
    {
      templateCode: 'DA_LIEU',
      name: 'Da liễu',
      specialtyName: 'Da liễu',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do khám',
            type: 'string',
            required: true,
          },
          {
            name: 'onset_date',
            label: 'Thời gian xuất hiện triệu chứng',
            type: 'date',
          },
          {
            name: 'rash_location',
            label: 'Vị trí tổn thương da',
            type: 'text',
          },
          {
            name: 'rash_characteristics',
            label: 'Đặc điểm tổn thương (màu sắc, vảy, dạng,...)',
            type: 'text',
          },
          { name: 'medications', label: 'Thuốc dùng', type: 'text' },
          { name: 'itching', label: 'Ngứa', type: 'boolean' },
          {
            name: 'exposure_history',
            label: 'Tiền sử tiếp xúc (dị nguyên, môi trường)',
            type: 'text',
          },
          {
            name: 'medical_history',
            label: 'Tiền sử bệnh lý (dị ứng, cơ địa,...)',
            type: 'text',
          },
          {
            name: 'lab_results',
            label: 'Xét nghiệm (HIV, nấm, test dị ứng)',
            type: 'text',
          },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán da liễu',
            type: 'string',
            required: true,
          },
          {
            name: 'treatment_plan',
            label: 'Điều trị (thuốc bôi, uống, kháng sinh)',
            type: 'text',
            required: true,
          },
          { name: 'follow_up', label: 'Tái khám', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
        ],
      },
    },
    // Sản khoa
    {
      templateCode: 'SAN_KHOA',
      name: 'Sản khoa',
      specialtyName: 'Sản khoa',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do nhập viện',
            type: 'string',
            required: true,
          },
          {
            name: 'gestational_age',
            label: 'Tuổi thai (tuần)',
            type: 'number',
          },
          {
            name: 'obstetric_history',
            label: 'Tiền sử sản khoa (para, gravida, sảy thai)',
            type: 'text',
          },
          { name: 'prenatal_care', label: 'Theo dõi thai kỳ', type: 'text' },
          { name: 'fetal_heart_rate', label: 'Nhịp tim thai', type: 'number' },
          {
            name: 'membranes_status',
            label: 'Tình trạng ối (vỡ ối, còn ối...)',
            type: 'string',
          },
          { name: 'contractions', label: 'Cơn gò tử cung', type: 'string' },
          {
            name: 'vaginal_exam',
            label: 'Khám âm đạo (cổ tử cung, ngôi, lọt)',
            type: 'text',
          },
          { name: 'ultrasound', label: 'Siêu âm sản khoa', type: 'text' },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán',
            type: 'string',
            required: true,
          },
          {
            name: 'delivery_plan',
            label: 'Kế hoạch sinh (đẻ thường, mổ lấy thai)',
            type: 'string',
          },
          { name: 'treatment_plan', label: 'Điều trị kèm theo', type: 'text' },
          { name: 'follow_up', label: 'Theo dõi', type: 'text' },
          {
            name: 'attachments',
            label: 'Tệp đính kèm (chẩn đoán hình ảnh, kết quả xét nghiệm...)',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                filetype: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
          {
            name: 'procedure_date',
            label: 'Ngày thực hiện thủ thuật / điều trị',
            type: 'date',
          },
        ],
      },
    },
    // Tai mũi họng
    {
      templateCode: 'TAI_MUI_HONG',
      name: 'Tai mũi họng',
      specialtyName: 'Tai mũi họng',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do khám',
            type: 'string',
            required: true,
          },
          { name: 'onset_date', label: 'Ngày khởi phát', type: 'date' },
          {
            name: 'symptom_description',
            label: 'Mô tả triệu chứng (đau tai, nghẹt mũi,...)',
            type: 'text',
          },
          { name: 'hearing_loss', label: 'Mức độ nghe giảm', type: 'string' },
          { name: 'nasal_discharge', label: 'Dịch mũi', type: 'string' },
          {
            name: 'throat_exam',
            label: 'Khám họng (amidan, họng đỏ...)',
            type: 'text',
          },
          { name: 'otoscopy', label: 'Soi tai', type: 'text' },
          { name: 'medications', label: 'Thuốc dùng', type: 'text' },
          { name: 'audiometry', label: 'Đo thính lực', type: 'text' },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán',
            type: 'string',
            required: true,
          },
          {
            name: 'treatment_plan',
            label: 'Điều trị (thuốc, phẫu thuật, hút mủ...)',
            type: 'text',
            required: true,
          },
          { name: 'follow_up', label: 'Tái khám', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
          {
            name: 'attachments',
            label: 'Tệp đính kèm (chẩn đoán hình ảnh, kết quả xét nghiệm...)',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                filetype: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
        ],
      },
    },
    // Phục hồi chức năng
    {
      templateCode: 'PHUC_HOI_CHUC_NANG',
      name: 'Phục hồi chức năng',
      specialtyName: 'Phục hồi chức năng',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do đến khám',
            type: 'string',
            required: true,
          },
          { name: 'onset_date', label: 'Ngày khởi phát', type: 'date' },
          {
            name: 'medical_history',
            label: 'Tiền sử bệnh lý (tai biến, chấn thương)',
            type: 'text',
          },
          {
            name: 'functional_status',
            label: 'Tình trạng chức năng hiện tại',
            type: 'text',
          },
          { name: 'muscle_strength', label: 'Sức cơ', type: 'string' },
          { name: 'range_of_motion', label: 'Tầm vận động', type: 'string' },
          {
            name: 'neurological_exam',
            label: 'Thăm khám thần kinh',
            type: 'text',
          },
          {
            name: 'rehabilitation_diagnosis',
            label: 'Chẩn đoán PHCN',
            type: 'string',
            required: true,
          },
          { name: 'rehab_goals', label: 'Mục tiêu phục hồi', type: 'text' },
          {
            name: 'treatment_plan',
            label: 'Kế hoạch điều trị (VLTL, hoạt động trị liệu...)',
            type: 'text',
            required: true,
          },
          { name: 'therapy_schedule', label: 'Lịch trị liệu', type: 'text' },
          { name: 'follow_up', label: 'Theo dõi tiến triển', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
        ],
      },
    },
    // Bỏng
    {
      templateCode: 'BONG',
      name: 'Bỏng',
      specialtyName: 'Bỏng',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do nhập viện',
            type: 'string',
            required: true,
          },
          {
            name: 'burn_cause',
            label: 'Nguyên nhân bỏng (nhiệt, hóa chất...)',
            type: 'string',
          },
          { name: 'burn_date', label: 'Thời điểm bị bỏng', type: 'date' },
          { name: 'burn_depth', label: 'Độ sâu bỏng', type: 'string' },
          {
            name: 'burn_area_percent',
            label: 'Diện tích bỏng (%)',
            type: 'number',
          },
          { name: 'burn_location', label: 'Vị trí vùng bỏng', type: 'text' },
          {
            name: 'vital_signs',
            label: 'Dấu hiệu sinh tồn',
            type: 'object',
            properties: {
              temp: { type: 'number' },
              bp: { type: 'string' },
              hr: { type: 'number' },
              rr: { type: 'number' },
            },
          },
          {
            name: 'infection_signs',
            label: 'Dấu hiệu nhiễm trùng',
            type: 'text',
          },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán',
            type: 'string',
            required: true,
          },
          {
            name: 'treatment_plan',
            label: 'Điều trị (dịch truyền, kháng sinh...)',
            type: 'text',
            required: true,
          },
          { name: 'medications', label: 'Thuốc dùng', type: 'text' },
          { name: 'wound_care', label: 'Chăm sóc vết bỏng', type: 'text' },
          { name: 'follow_up', label: 'Tái khám', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
        ],
      },
    },
    // Huyết học/truyền máu
    {
      templateCode: 'HUYET_HOC_TRUYEN_MAU',
      name: 'Huyết học/truyền máu',
      specialtyName: 'Huyết học/truyền máu',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do khám',
            type: 'string',
            required: true,
          },
          { name: 'anemia_history', label: 'Tiền sử thiếu máu', type: 'text' },
          {
            name: 'bleeding_symptoms',
            label: 'Triệu chứng xuất huyết',
            type: 'text',
          },
          {
            name: 'transfusion_history',
            label: 'Lịch sử truyền máu',
            type: 'text',
          },
          { name: 'family_history', label: 'Tiền sử gia đình', type: 'text' },
          {
            name: 'lab_results',
            label: 'Kết quả xét nghiệm máu',
            type: 'text',
          },
          {
            name: 'bone_marrow_exam',
            label: 'Xét nghiệm tủy xương',
            type: 'text',
          },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán huyết học',
            type: 'string',
            required: true,
          },
          {
            name: 'treatment_plan',
            label: 'Kế hoạch điều trị (truyền, hóa trị...)',
            type: 'text',
            required: true,
          },
          { name: 'monitoring', label: 'Theo dõi', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
        ],
      },
    },
    // Tâm thần
    {
      templateCode: 'TAM_THAN',
      name: 'Tâm thần',
      specialtyName: 'Tâm thần',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do khám',
            type: 'string',
            required: true,
          },
          {
            name: 'psychiatric_history',
            label: 'Tiền sử tâm thần',
            type: 'text',
          },
          { name: 'substance_use', label: 'Lạm dụng chất', type: 'text' },
          {
            name: 'behavioral_observation',
            label: 'Quan sát hành vi',
            type: 'text',
          },
          { name: 'mood_affect', label: 'Khí sắc / cảm xúc', type: 'string' },
          {
            name: 'thought_content',
            label: 'Nội dung tư duy (hoang tưởng...)',
            type: 'text',
          },
          {
            name: 'cognition_status',
            label: 'Tình trạng nhận thức',
            type: 'text',
          },
          { name: 'mental_exam', label: 'Khám tâm thần', type: 'text' },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán rối loạn',
            type: 'string',
            required: true,
          },
          {
            name: 'treatment_plan',
            label: 'Điều trị (thuốc an thần, tâm lý...)',
            type: 'text',
            required: true,
          },
          { name: 'risk_assessment', label: 'Đánh giá nguy cơ', type: 'text' },
          { name: 'follow_up', label: 'Tái khám / giám sát', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
        ],
      },
    },
    // Ngoại trú chung
    {
      templateCode: 'NGOAI_TRU_CHUNG',
      name: 'Ngoại trú chung',
      specialtyName: 'Ngoại trú chung',
      fields: {
        fields: [
          {
            name: 'chief_complaint',
            label: 'Lý do khám',
            type: 'string',
            required: true,
          },
          {
            name: 'history_of_present_illness',
            label: 'Diễn tiến bệnh',
            type: 'text',
          },
          { name: 'medical_history', label: 'Tiền sử bệnh', type: 'text' },
          { name: 'medications', label: 'Thuốc dùng', type: 'text' },
          {
            name: 'vital_signs',
            label: 'Dấu hiệu sinh tồn',
            type: 'object',
            properties: {
              temp: { type: 'number' },
              bp: { type: 'string' },
              hr: { type: 'number' },
              rr: { type: 'number' },
            },
          },
          { name: 'physical_exam', label: 'Khám lâm sàng', type: 'text' },
          {
            name: 'diagnosis',
            label: 'Chẩn đoán sơ bộ',
            type: 'string',
            required: true,
          },
          {
            name: 'treatment_plan',
            label: 'Kê toa / hướng dẫn điều trị',
            type: 'text',
            required: true,
          },
          { name: 'follow_up', label: 'Dặn dò / tái khám', type: 'text' },
          { name: 'notes', label: 'Ghi chú', type: 'text' },
        ],
      },
    },
  ];

  // Tạo template cho từng chuyên khoa
  for (const t of templates) {
    const specialty = specialtyMap[t.specialtyName];
    if (!specialty) continue;
    await prisma.template.create({
      data: {
        templateCode: t.templateCode,
        name: t.name,
        fields: t.fields,
        isActive: true,
        specialtyId: specialty.id,
      },
    });
  }

  // 3. TẠM THỜI BỎ cách phát sinh phòng khám và dịch vụ theo for để tránh nhân bản service theo từng phòng
  // Vui lòng sử dụng file `prisma/seed_clinic.ts` để seed dữ liệu phòng, bác sĩ, dịch vụ và mapping n-n.
  // const targetSpecialties: never[] = [];

  console.log(
    '🎉 Basic seed completed! Please run the following commands to complete the setup:',
  );
  console.log(
    '1. npm run seed:specialties - to seed specialties from JSON file',
  );
  console.log(
    '2. npm run seed:clinic-rooms - to seed clinic rooms from JSON file',
  );
  console.log(
    '3. npm run seed:clinic - to seed doctors and additional clinic data',
  );
  console.log('4. npm run seed:booths - to seed booths from JSON file');
  console.log('5. npm run seed:services - to seed services from JSON file');
  console.log('6. npm run seed:worksession - to seed work sessions');

  const password = await bcrypt.hash('123456789', 10);

  // 4. Tạo các user và auth cho từng role
  let doctorAuth = await prisma.auth.findUnique({
    where: { email: 'doctor@gmail.com' },
  });
  if (!doctorAuth) {
    doctorAuth = await prisma.auth.create({
      data: {
        name: 'Trần Đình Kiên',
        dateOfBirth: new Date('2003-05-07'),
        email: 'doctor@gmail.com',
        phone: '0325421882',
        password: password,
        gender: 'male',
        avatar: null,
        address: 'TP HCM',
        citizenId: '1111111111',
        role: 'DOCTOR',
      },
    });
  }

  const existedDefaultDoctor = await prisma.doctor.findUnique({
    where: { authId: doctorAuth.id },
  });
  if (!existedDefaultDoctor) {
    await prisma.doctor.create({
      data: {
        id: doctorAuth.id, // Sử dụng cùng id với auth
        doctorCode: 'DOC001',
        authId: doctorAuth.id,
        degrees: ['Bác sĩ đa khoa'],
        yearsExperience: 10,
        rating: 4.8,
        workHistory: 'Bệnh viện Trà Ôn',
        description: 'Chuyên gia nội tổng quát',
      },
    });
  }

  // Patient
  let patientAuth = await prisma.auth.findUnique({
    where: { email: 'patient@gmail.com' },
  });
  if (!patientAuth) {
    patientAuth = await prisma.auth.create({
      data: {
        name: 'Nguyễn Thanh Cảnh',
        dateOfBirth: new Date('2003-01-01'),
        email: 'patient@gmail.com',
        phone: '0900000001',
        password: password,
        gender: 'male',
        avatar: null,
        address: 'TP HCM',
        citizenId: '2222222222',
        role: 'PATIENT',
      },
    });
  }

  const existedPatient = await prisma.patient.findUnique({
    where: { authId: patientAuth.id },
  });
  if (!existedPatient) {
    await prisma.patient.create({
      data: {
        id: patientAuth.id, // Sử dụng cùng id với auth
        patientCode: 'PAT001',
        authId: patientAuth.id,
        loyaltyPoints: 100,
      },
    });
  }

  // Tạo nhiều hồ sơ khám bệnh (PatientProfile) cho bệnh nhân trên
  const relationships = ['self', 'child', 'spouse', 'parent'];
  for (let i = 1; i <= 20; i++) {
    const idx = `${i}`.padStart(2, '0');
    const existedProfile = await prisma.patientProfile.findFirst({
      where: { profileCode: `PP_${idx}`, patientId: patientAuth.id },
    });
    if (!existedProfile) {
      await prisma.patientProfile.create({
        data: {
          profileCode: `PP_${idx}`,
          patientId: patientAuth.id,
          name: `Bệnh nhân ${idx}`,
          dateOfBirth: new Date(`199${i % 10}-0${(i % 9) + 1}-15`),
          gender: i % 2 === 0 ? 'male' : 'female',
          address: 'TP HCM',
          occupation: 'Nhân viên văn phòng',
          emergencyContact: { name: 'Liên hệ khẩn cấp', phone: `090000${idx}` },
          healthInsurance: i % 3 === 0 ? 'BHYT-TEST' : null,
          relationship: relationships[i % relationships.length],
        },
      });
    }
  }

  // Receptionist
  let receptionistAuth = await prisma.auth.findUnique({
    where: { email: 'receptionist@gmail.com' },
  });
  if (!receptionistAuth) {
    receptionistAuth = await prisma.auth.create({
      data: {
        name: 'Lê Hoàng Khang',
        dateOfBirth: new Date('1990-03-10'),
        email: 'receptionist@gmail.com',
        phone: '0900000002',
        password: password,
        gender: 'male',
        avatar: null,
        address: 'TP HCM',
        citizenId: '3333333333',
        role: 'RECEPTIONIST',
      },
    });
  }

  const existedReceptionist = await prisma.receptionist.findUnique({
    where: { authId: receptionistAuth.id },
  });
  if (!existedReceptionist) {
    await prisma.receptionist.create({
      data: {
        id: receptionistAuth.id, // Sử dụng cùng id với auth
        authId: receptionistAuth.id,
      },
    });
  }

  // Admin
  let adminAuth = await prisma.auth.findUnique({
    where: { email: 'admin@gmail.com' },
  });
  if (!adminAuth) {
    adminAuth = await prisma.auth.create({
      data: {
        name: 'Trần Đình Kiên',
        dateOfBirth: new Date('2003-05-07'),
        email: 'admin@gmail.com',
        phone: '0325421881',
        password: password,
        gender: 'male',
        avatar:
          'https://res.cloudinary.com/dxxsudprj/image/upload/v1733839978/Anime_Characters_cnkjji.jpg',
        address: 'TP HCM',
        citizenId: '4444444444',
        role: 'ADMIN',
      },
    });
  }

  const existedAdmin = await prisma.admin.findUnique({
    where: { authId: adminAuth.id },
  });
  if (!existedAdmin) {
    await prisma.admin.create({
      data: {
        id: adminAuth.id, // Sử dụng cùng id với auth
        adminCode: 'AD001',
        authId: adminAuth.id,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .finally(() => prisma.$disconnect());
