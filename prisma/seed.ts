import { PrismaClient, Prisma } from '@prisma/client';
// Embedded data instead of reading JSON files
import * as bcrypt from 'bcryptjs';
import { CodeGeneratorService } from '../src/user-management/patient-profile/code-generator.service';

const prisma = new PrismaClient();
const codeGen = new CodeGeneratorService();

async function main() {
  // 2.1. Tạo danh sách các chuyên khoa (Specialty)
  const specialties = [
    {
      specialtyCode: 'NOITONGQUAT',
      name: 'Nội tổng quát',
      description:
        'Chuyên khoa điều trị các bệnh lý nội khoa tổng quát, bao gồm các bệnh tim mạch, hô hấp, tiêu hóa và nội tiết.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043352/da-khoa_ldgwhl.png',
    },
    {
      specialtyCode: 'RANGHAMMAT',
      name: 'Răng hàm mặt',
      description:
        'Chuyên khoa chăm sóc và điều trị các bệnh lý về răng, hàm mặt, bao gồm nha khoa tổng quát và phẫu thuật hàm mặt.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043351/rang-ham-mat_lkuean.png',
    },
    {
      specialtyCode: 'MAT',
      name: 'Mắt',
      description:
        'Chuyên khoa điều trị các bệnh lý về mắt, bao gồm khúc xạ, phẫu thuật mắt và điều trị các bệnh lý mắt phức tạp.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043352/mat_tpfp6a.png',
    },
    {
      specialtyCode: 'NGOAIKHOA',
      name: 'Ngoại khoa',
      description:
        'Chuyên khoa phẫu thuật điều trị các bệnh lý cần can thiệp ngoại khoa, bao gồm phẫu thuật tổng quát và chuyên sâu.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761656623/Screenshot_2025-10-28_at_20.01.45_wuj3yl.png',
    },
    {
      specialtyCode: 'UNGBUOU',
      name: 'Ung bướu',
      description:
        'Chuyên khoa điều trị các bệnh ung thư và khối u, bao gồm hóa trị, xạ trị và phẫu thuật ung bướu.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761656623/Screenshot_2025-10-28_at_20.02.48_vxjcef.png',
    },
    {
      specialtyCode: 'TRUYENNHIEM',
      name: 'Truyền nhiễm',
      description:
        'Chuyên khoa điều trị các bệnh truyền nhiễm, bao gồm các bệnh do vi khuẩn, virus, ký sinh trùng và nấm.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761656623/Screenshot_2025-10-28_at_20.02.48_vxjcef.png',
    },
    {
      specialtyCode: 'NHIKHOA',
      name: 'Nhi khoa',
      description:
        'Chuyên khoa chăm sóc sức khỏe trẻ em từ sơ sinh đến 18 tuổi, bao gồm điều trị và phòng ngừa bệnh tật.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043351/nhi_oiew69.png',
    },
    {
      specialtyCode: 'PHUKHOA',
      name: 'Phụ khoa',
      description:
        'Chuyên khoa chăm sóc sức khỏe phụ nữ, bao gồm điều trị các bệnh lý về cơ quan sinh dục nữ.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043352/tiet-nieu_oitmi1.png',
    },
    {
      specialtyCode: 'DALIEU',
      name: 'Da liễu',
      description:
        'Chuyên khoa điều trị các bệnh lý về da, tóc, móng và các bệnh lây truyền qua đường tình dục.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043352/da-lieu_w9foei.png',
    },
    {
      specialtyCode: 'SANKHOA',
      name: 'Sản khoa',
      description:
        'Chuyên khoa chăm sóc phụ nữ mang thai, sinh con và hậu sản, bao gồm theo dõi thai kỳ và đỡ đẻ.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761656623/Screenshot_2025-10-28_at_20.00.44_em6non.png',
    },
    {
      specialtyCode: 'TAIMUIHONG',
      name: 'Tai mũi họng',
      description:
        'Chuyên khoa điều trị các bệnh lý về tai, mũi, họng và các cơ quan liên quan như thanh quản.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043351/tai-mui-hong_n7jmyj.png',
    },
    {
      specialtyCode: 'PHUCHOICHUCNANG',
      name: 'Phục hồi chức năng',
      description:
        'Chuyên khoa phục hồi chức năng vận động, ngôn ngữ và nhận thức cho bệnh nhân sau chấn thương hoặc bệnh tật.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043351/phuc-hoi_kgmpxy.png',
    },
    {
      specialtyCode: 'BONG',
      name: 'Bỏng',
      description:
        'Chuyên khoa điều trị các vết bỏng do nhiệt, hóa chất, điện và các nguyên nhân khác.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761656932/Screenshot_2025-10-28_at_20.08.44_nge5mo.png',
    },
    {
      specialtyCode: 'HUYETHOCTRUYENMAU',
      name: 'Huyết học/truyền máu',
      description:
        'Chuyên khoa điều trị các bệnh lý về máu, cơ quan tạo máu và thực hiện truyền máu.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761656877/Screenshot_2025-10-28_at_20.07.50_fqislb.png',
    },
    {
      specialtyCode: 'TAMTHAN',
      name: 'Tâm thần',
      description:
        'Chuyên khoa điều trị các rối loạn tâm thần, hành vi và các vấn đề sức khỏe tâm lý.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761656623/Screenshot_2025-10-28_at_20.03.30_myq5cc.png',
    },
    {
      specialtyCode: 'NGOAITRUCHUNG',
      name: 'Ngoại trú chung',
      description:
        'Dịch vụ khám ngoại trú tổng quát cho các bệnh lý thông thường và chăm sóc sức khỏe định kỳ.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043352/ngoai-khoa_w3ts4p.png',
    },
    {
      specialtyCode: 'TIMMACH',
      name: 'Tim mạch',
      description:
        'Chuyên khoa điều trị các bệnh lý về tim mạch, bao gồm các bệnh tim mạch, động mạch vành,...',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043352/tim_clspx6.png',
    },
    {
      specialtyCode: 'CHINHHINHXUONGKHOP',
      name: 'Chỉnh hình xương khớp',
      description:
        'Chuyên khoa điều trị các bệnh lý về chỉnh hình, bao gồm các bệnh chỉnh hình, điều trị chỉnh hình,...',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043351/chinh-hinh_fahdlq.png',
    },
    {
      specialtyCode: 'TIEUHOA',
      name: 'Tiêu hóa',
      description:
        'Chuyên khoa điều trị các bệnh lý về tiêu hóa, bao gồm các bệnh tiêu hóa, điều trị tiêu hóa,...',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043351/tieu-hoa_filenk.png',
    },
    {
      specialtyCode: 'CHUANDOANHINHANH',
      name: 'Chuẩn đoán hình ảnh',
      description:
        'Chuyên khoa chẩn đoán hình ảnh, thực hiện X-quang, CT, MRI, siêu âm để hỗ trợ chẩn đoán.',
      imgUrl:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1761043351/chinh-hinh_fahdlq.png',
    },
  ];

  // Thêm services cho khoa Tim mạch (sẽ được push sau khi servicesJson được khai báo)

  // Tạo specialty và lưu lại id theo tên
  const specialtyMap: Record<string, { id: string; name: string }> = {};
  for (const specialty of specialties) {
    const s = await prisma.specialty.create({
      data: {
        name: specialty.name,
        specialtyCode: specialty.specialtyCode,
        description: specialty.description,
        imgUrl: specialty.imgUrl,
      },
    });
    specialtyMap[specialty.name] = { id: s.id, name: specialty.name };
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
  // 2.3. Bổ sung các template ánh xạ theo yêu cầu
  {
    const noi = await prisma.template.findFirst({
      where: { templateCode: 'NOI_KHOA' },
    });
    const phcn = await prisma.template.findFirst({
      where: { templateCode: 'PHUC_HOI_CHUC_NANG' },
    });
    const ngoai = await prisma.template.findFirst({
      where: { templateCode: 'NGOAI_KHOA' },
    });

    const ensureTemplate = async (
      code: string,
      name: string,
      specialtyName: string,
      fromTemplateFields: Prisma.InputJsonValue | null,
    ): Promise<void> => {
      const spec = specialtyMap[specialtyName];
      if (!spec || !fromTemplateFields) return;
      const existed = await prisma.template.findFirst({
        where: { templateCode: code, specialtyId: spec.id },
      });
      if (!existed) {
        await prisma.template.create({
          data: {
            templateCode: code,
            name,
            fields: fromTemplateFields as Prisma.InputJsonValue,
            isActive: true,
            specialtyId: spec.id,
          },
        });
      }
    };

    await ensureTemplate(
      'TIM_MACH_NOI',
      'Tim mạch (mẫu Nội khoa)',
      'Tim mạch',
      noi?.fields ?? null,
    );
    await ensureTemplate(
      'TIEU_HOA_NOI',
      'Tiêu hóa (mẫu Nội khoa)',
      'Tiêu hóa',
      noi?.fields ?? null,
    );
    await ensureTemplate(
      'CDHA_PHUC_HOI',
      'Chẩn đoán hình ảnh (mẫu Phục hồi chức năng)',
      'Chuẩn đoán hình ảnh',
      phcn?.fields ?? null,
    );
    await ensureTemplate(
      'CHINH_HINH_NGOAI',
      'Chỉnh hình xương khớp (mẫu Ngoại khoa)',
      'Chỉnh hình xương khớp',
      ngoai?.fields ?? null,
    );
  }

  // 3. Import dữ liệu (embedded arrays) và liên kết bảng (ClinicRoom, Booth, Service, Counter)
  // Chuẩn hoá specialtyCode từ JSON -> specialtyId
  const specialtyCodeFixMap: Record<string, string> = {
    TRUYENNHI: 'TRUYENNHIEM',
    PHUCHOICHNANG: 'PHUCHOICHUCNANG',
  };

  // Remove file I/O, embed arrays directly for deterministic seeds

  // 3.1. Seed Clinic Rooms
  type ClinicRoomJson = {
    roomCode: string;
    roomName: string;
    specialtyCode: string;
    description?: string;
    address?: string;
  };

  const clinicRoomsJson: ClinicRoomJson[] = [
    {
      roomCode: 'NOI-101',
      roomName: 'Phòng Nội 101',
      specialtyCode: 'NOITONGQUAT',
      description: 'Khám nội tổng quát',
      address: 'Tầng 1 - Khu A',
    },
    {
      roomCode: 'NOI-102',
      roomName: 'Phòng Nội 102',
      specialtyCode: 'NOITONGQUAT',
      description: 'Khám nội tổng quát',
      address: 'Tầng 1 - Khu A',
    },
    {
      roomCode: 'NOI-103',
      roomName: 'Phòng Nội 103',
      specialtyCode: 'NOITONGQUAT',
      description: 'Khám nội tổng quát',
      address: 'Tầng 1 - Khu A',
    },
    {
      roomCode: 'NOI-104',
      roomName: 'Phòng Nội 104',
      specialtyCode: 'NOITONGQUAT',
      description: 'Khám nội tổng quát',
      address: 'Tầng 1 - Khu A',
    },
    {
      roomCode: 'RHM-201',
      roomName: 'Phòng Nha 201',
      specialtyCode: 'RANGHAMMAT',
      description: 'Khám răng hàm mặt',
      address: 'Tầng 2 - Khu B',
    },
    {
      roomCode: 'RHM-202',
      roomName: 'Phòng Nha 202',
      specialtyCode: 'RANGHAMMAT',
      description: 'Điều trị nha khoa',
      address: 'Tầng 2 - Khu B',
    },
    {
      roomCode: 'RHM-203',
      roomName: 'Phòng Nha 203',
      specialtyCode: 'RANGHAMMAT',
      description: 'Tư vấn chỉnh nha',
      address: 'Tầng 2 - Khu B',
    },
    {
      roomCode: 'RHM-204',
      roomName: 'Phòng Nha 204',
      specialtyCode: 'RANGHAMMAT',
      description: 'Phẫu thuật răng hàm mặt',
      address: 'Tầng 2 - Khu B',
    },
    {
      roomCode: 'MAT-301',
      roomName: 'Phòng Mắt 301',
      specialtyCode: 'MAT',
      description: 'Khám mắt tổng quát',
      address: 'Tầng 3 - Khu A',
    },
    {
      roomCode: 'MAT-302',
      roomName: 'Phòng Mắt 302',
      specialtyCode: 'MAT',
      description: 'Đo khúc xạ',
      address: 'Tầng 3 - Khu A',
    },
    {
      roomCode: 'MAT-303',
      roomName: 'Phòng Mắt 303',
      specialtyCode: 'MAT',
      description: 'Điều trị mắt',
      address: 'Tầng 3 - Khu A',
    },
    {
      roomCode: 'MAT-304',
      roomName: 'Phòng Mắt 304',
      specialtyCode: 'MAT',
      description: 'Tư vấn phẫu thuật mắt',
      address: 'Tầng 3 - Khu A',
    },
    {
      roomCode: 'NGO-401',
      roomName: 'Phòng Ngoại 401',
      specialtyCode: 'NGOAIKHOA',
      description: 'Khám ngoại khoa',
      address: 'Tầng 4 - Khu B',
    },
    {
      roomCode: 'NGO-402',
      roomName: 'Phòng Ngoại 402',
      specialtyCode: 'NGOAIKHOA',
      description: 'Thủ thuật ngoại khoa',
      address: 'Tầng 4 - Khu B',
    },
    {
      roomCode: 'NGO-403',
      roomName: 'Phòng Ngoại 403',
      specialtyCode: 'NGOAIKHOA',
      description: 'Hậu phẫu',
      address: 'Tầng 4 - Khu B',
    },
    {
      roomCode: 'NGO-404',
      roomName: 'Phòng Ngoại 404',
      specialtyCode: 'NGOAIKHOA',
      description: 'Tư vấn phẫu thuật',
      address: 'Tầng 4 - Khu B',
    },
    {
      roomCode: 'UBU-501',
      roomName: 'Phòng Ung bướu 501',
      specialtyCode: 'UNGBUOU',
      description: 'Khám ung bướu',
      address: 'Tầng 5 - Khu A',
    },
    {
      roomCode: 'UBU-502',
      roomName: 'Phòng Ung bướu 502',
      specialtyCode: 'UNGBUOU',
      description: 'Hóa trị',
      address: 'Tầng 5 - Khu A',
    },
    {
      roomCode: 'UBU-503',
      roomName: 'Phòng Ung bướu 503',
      specialtyCode: 'UNGBUOU',
      description: 'Xạ trị (tiếp nhận)',
      address: 'Tầng 5 - Khu A',
    },
    {
      roomCode: 'UBU-504',
      roomName: 'Phòng Ung bướu 504',
      specialtyCode: 'UNGBUOU',
      description: 'Tư vấn điều trị',
      address: 'Tầng 5 - Khu A',
    },
    {
      roomCode: 'TNN-601',
      roomName: 'Phòng Truyền nhiễm 601',
      specialtyCode: 'TRUYENNHI',
      description: 'Khám bệnh truyền nhiễm',
      address: 'Tầng 6 - Khu B',
    },
    {
      roomCode: 'TNN-602',
      roomName: 'Phòng Truyền nhiễm 602',
      specialtyCode: 'TRUYENNHI',
      description: 'Theo dõi cách ly',
      address: 'Tầng 6 - Khu B',
    },
    {
      roomCode: 'TNN-603',
      roomName: 'Phòng Truyền nhiễm 603',
      specialtyCode: 'TRUYENNHI',
      description: 'Tư vấn điều trị',
      address: 'Tầng 6 - Khu B',
    },
    {
      roomCode: 'TNN-604',
      roomName: 'Phòng Truyền nhiễm 604',
      specialtyCode: 'TRUYENNHI',
      description: 'Tiếp nhận xét nghiệm',
      address: 'Tầng 6 - Khu B',
    },
    {
      roomCode: 'NHI-701',
      roomName: 'Phòng Nhi 701',
      specialtyCode: 'NHIKHOA',
      description: 'Khám nhi',
      address: 'Tầng 7 - Khu A',
    },
    {
      roomCode: 'NHI-702',
      roomName: 'Phòng Nhi 702',
      specialtyCode: 'NHIKHOA',
      description: 'Tiêm chủng',
      address: 'Tầng 7 - Khu A',
    },
    {
      roomCode: 'NHI-703',
      roomName: 'Phòng Nhi 703',
      specialtyCode: 'NHIKHOA',
      description: 'Theo dõi sốt',
      address: 'Tầng 7 - Khu A',
    },
    {
      roomCode: 'NHI-704',
      roomName: 'Phòng Nhi 704',
      specialtyCode: 'NHIKHOA',
      description: 'Tư vấn dinh dưỡng',
      address: 'Tầng 7 - Khu A',
    },
    {
      roomCode: 'PHU-801',
      roomName: 'Phòng Phụ khoa 801',
      specialtyCode: 'PHUKHOA',
      description: 'Khám phụ khoa',
      address: 'Tầng 8 - Khu B',
    },
    {
      roomCode: 'PHU-802',
      roomName: 'Phòng Phụ khoa 802',
      specialtyCode: 'PHUKHOA',
      description: 'Siêu âm phụ khoa',
      address: 'Tầng 8 - Khu B',
    },
    {
      roomCode: 'PHU-803',
      roomName: 'Phòng Phụ khoa 803',
      specialtyCode: 'PHUKHOA',
      description: 'Điều trị phụ khoa',
      address: 'Tầng 8 - Khu B',
    },
    {
      roomCode: 'PHU-804',
      roomName: 'Phòng Phụ khoa 804',
      specialtyCode: 'PHUKHOA',
      description: 'Tư vấn kế hoạch hóa',
      address: 'Tầng 8 - Khu B',
    },
    {
      roomCode: 'DAL-901',
      roomName: 'Phòng Da liễu 901',
      specialtyCode: 'DALIEU',
      description: 'Khám da liễu',
      address: 'Tầng 9 - Khu A',
    },
    {
      roomCode: 'DAL-902',
      roomName: 'Phòng Da liễu 902',
      specialtyCode: 'DALIEU',
      description: 'Điều trị mụn/nám',
      address: 'Tầng 9 - Khu A',
    },
    {
      roomCode: 'DAL-903',
      roomName: 'Phòng Da liễu 903',
      specialtyCode: 'DALIEU',
      description: 'Thủ thuật da liễu',
      address: 'Tầng 9 - Khu A',
    },
    {
      roomCode: 'DAL-904',
      roomName: 'Phòng Da liễu 904',
      specialtyCode: 'DALIEU',
      description: 'Tư vấn da liễu',
      address: 'Tầng 9 - Khu A',
    },
    {
      roomCode: 'SAN-1001',
      roomName: 'Phòng Sản 1001',
      specialtyCode: 'SANKHOA',
      description: 'Khám thai',
      address: 'Tầng 10 - Khu B',
    },
    {
      roomCode: 'SAN-1002',
      roomName: 'Phòng Sản 1002',
      specialtyCode: 'SANKHOA',
      description: 'Siêu âm sản',
      address: 'Tầng 10 - Khu B',
    },
    {
      roomCode: 'SAN-1003',
      roomName: 'Phòng Sản 1003',
      specialtyCode: 'SANKHOA',
      description: 'Tư vấn tiền sản',
      address: 'Tầng 10 - Khu B',
    },
    {
      roomCode: 'SAN-1004',
      roomName: 'Phòng Sản 1004',
      specialtyCode: 'SANKHOA',
      description: 'Theo dõi sau sinh',
      address: 'Tầng 10 - Khu B',
    },
    {
      roomCode: 'TMH-1101',
      roomName: 'Phòng TMH 1101',
      specialtyCode: 'TAIMUIHONG',
      description: 'Khám tai mũi họng',
      address: 'Tầng 11 - Khu A',
    },
    {
      roomCode: 'TMH-1102',
      roomName: 'Phòng TMH 1102',
      specialtyCode: 'TAIMUIHONG',
      description: 'Nội soi TMH',
      address: 'Tầng 11 - Khu A',
    },
    {
      roomCode: 'TMH-1103',
      roomName: 'Phòng TMH 1103',
      specialtyCode: 'TAIMUIHONG',
      description: 'Điều trị TMH',
      address: 'Tầng 11 - Khu A',
    },
    {
      roomCode: 'TMH-1104',
      roomName: 'Phòng TMH 1104',
      specialtyCode: 'TAIMUIHONG',
      description: 'Tư vấn TMH',
      address: 'Tầng 11 - Khu A',
    },
    {
      roomCode: 'PHC-1201',
      roomName: 'Phòng PHCN 1201',
      specialtyCode: 'PHUCHOICHNANG',
      description: 'Phục hồi chức năng',
      address: 'Tầng 12 - Khu B',
    },
    {
      roomCode: 'PHC-1202',
      roomName: 'Phòng PHCN 1202',
      specialtyCode: 'PHUCHOICHNANG',
      description: 'Vật lý trị liệu',
      address: 'Tầng 12 - Khu B',
    },
    {
      roomCode: 'PHC-1203',
      roomName: 'Phòng PHCN 1203',
      specialtyCode: 'PHUCHOICHNANG',
      description: 'Âm ngữ trị liệu',
      address: 'Tầng 12 - Khu B',
    },
    {
      roomCode: 'PHC-1204',
      roomName: 'Phòng PHCN 1204',
      specialtyCode: 'PHUCHOICHNANG',
      description: 'Hoạt động trị liệu',
      address: 'Tầng 12 - Khu B',
    },
    {
      roomCode: 'BON-1301',
      roomName: 'Phòng Bỏng 1301',
      specialtyCode: 'BONG',
      description: 'Khám và xử trí bỏng',
      address: 'Tầng 13 - Khu A',
    },
    {
      roomCode: 'BON-1302',
      roomName: 'Phòng Bỏng 1302',
      specialtyCode: 'BONG',
      description: 'Chăm sóc vết bỏng',
      address: 'Tầng 13 - Khu A',
    },
    {
      roomCode: 'BON-1303',
      roomName: 'Phòng Bỏng 1303',
      specialtyCode: 'BONG',
      description: 'Theo dõi sau bỏng',
      address: 'Tầng 13 - Khu A',
    },
    {
      roomCode: 'BON-1304',
      roomName: 'Phòng Bỏng 1304',
      specialtyCode: 'BONG',
      description: 'Tư vấn điều trị bỏng',
      address: 'Tầng 13 - Khu A',
    },
    {
      roomCode: 'HUY-1401',
      roomName: 'Phòng Huyết học 1401',
      specialtyCode: 'HUYETHOCTRUYENMAU',
      description: 'Khám huyết học',
      address: 'Tầng 14 - Khu B',
    },
    {
      roomCode: 'HUY-1402',
      roomName: 'Phòng Truyền máu 1402',
      specialtyCode: 'HUYETHOCTRUYENMAU',
      description: 'Truyền máu - theo dõi',
      address: 'Tầng 14 - Khu B',
    },
    {
      roomCode: 'HUY-1403',
      roomName: 'Phòng Huyết học 1403',
      specialtyCode: 'HUYETHOCTRUYENMAU',
      description: 'Xét nghiệm huyết học (tiếp nhận)',
      address: 'Tầng 14 - Khu B',
    },
    {
      roomCode: 'HUY-1404',
      roomName: 'Phòng Tư vấn 1404',
      specialtyCode: 'HUYETHOCTRUYENMAU',
      description: 'Tư vấn truyền máu',
      address: 'Tầng 14 - Khu B',
    },
    {
      roomCode: 'HUY-1405',
      roomName: 'Phòng Xét nghiệm máu 1405',
      specialtyCode: 'HUYETHOCTRUYENMAU',
      description: 'Xét nghiệm máu',
      address: 'Tầng 14 - Khu B',
    },
    {
      roomCode: 'TAM-1501',
      roomName: 'Phòng Tâm thần 1501',
      specialtyCode: 'TAMTHAN',
      description: 'Khám tâm thần',
      address: 'Tầng 15 - Khu A',
    },
    {
      roomCode: 'TAM-1502',
      roomName: 'Phòng Tâm lý 1502',
      specialtyCode: 'TAMTHAN',
      description: 'Tư vấn tâm lý',
      address: 'Tầng 15 - Khu A',
    },
    {
      roomCode: 'TAM-1503',
      roomName: 'Phòng Điều trị 1503',
      specialtyCode: 'TAMTHAN',
      description: 'Điều trị ngoại trú',
      address: 'Tầng 15 - Khu A',
    },
    {
      roomCode: 'TAM-1504',
      roomName: 'Phòng Trị liệu 1504',
      specialtyCode: 'TAMTHAN',
      description: 'Trị liệu hành vi',
      address: 'Tầng 15 - Khu A',
    },
    {
      roomCode: 'NTC-1601',
      roomName: 'Phòng Ngoại trú 1601',
      specialtyCode: 'NGOAITRUCHUNG',
      description: 'Khám ngoại trú chung',
      address: 'Tầng 16 - Khu B',
    },
    {
      roomCode: 'NTC-1602',
      roomName: 'Phòng Ngoại trú 1602',
      specialtyCode: 'NGOAITRUCHUNG',
      description: 'Theo dõi điều trị',
      address: 'Tầng 16 - Khu B',
    },
    {
      roomCode: 'NTC-1603',
      roomName: 'Phòng Ngoại trú 1603',
      specialtyCode: 'NGOAITRUCHUNG',
      description: 'Thủ thuật nhẹ',
      address: 'Tầng 16 - Khu B',
    },
    {
      roomCode: 'NTC-1604',
      roomName: 'Phòng Ngoại trú 1604',
      specialtyCode: 'NGOAITRUCHUNG',
      description: 'Tư vấn - sàng lọc',
      address: 'Tầng 16 - Khu B',
    },
    {
      roomCode: 'CHU-1801',
      roomName: 'Phòng Chụp X-quang 1801',
      specialtyCode: 'CHUANDOANHINHANH',
      description: 'Chụp X-quang',
      address: 'Tầng 18 - Khu B',
    },
    {
      roomCode: 'CHU-1802',
      roomName: 'Phòng Chụp X-quang 1802',
      specialtyCode: 'CHUANDOANHINHANH',
      description: 'Xét nghiệm X-quang',
      address: 'Tầng 18 - Khu B',
    },
    {
      roomCode: 'CHU-1803',
      roomName: 'Phòng Chụp X-quang 1803',
      specialtyCode: 'CHUANDOANHINHANH',
      description: 'Tư vấn chụp X-quang',
      address: 'Tầng 18 - Khu B',
    },
    {
      roomCode: 'CHU-1804',
      roomName: 'Phòng Chụp X-quang 1804',
      specialtyCode: 'CHUANDOANHINHANH',
      description: 'Điều trị X-quang',
      address: 'Tầng 18 - Khu B',
    },
    {
      roomCode: 'CT-1901',
      roomName: 'Phòng CT 1901',
      specialtyCode: 'CHUANDOANHINHANH',
      description: 'CT',
      address: 'Tầng 19 - Khu A',
    },
    {
      roomCode: 'TIM-1701',
      roomName: 'Phòng Tim mạch 1701',
      specialtyCode: 'TIMMACH',
      description: 'Khám tim mạch',
      address: 'Tầng 17 - Khu A',
    },
  ];

  // Đảm bảo tồn tại thêm các specialty có trong file JSON nhưng chưa có trong DB
  const uniqueSpecialtyCodesFromRooms = Array.from(
    new Set(
      clinicRoomsJson.map((r) =>
        (specialtyCodeFixMap[r.specialtyCode] ?? r.specialtyCode).toUpperCase(),
      ),
    ),
  );

  const specialtyCodeToId: Record<string, string> = {};
  for (const code of uniqueSpecialtyCodesFromRooms) {
    const fixedCode = code;
    const existed = await prisma.specialty.findUnique({
      where: { specialtyCode: fixedCode },
    });
    if (existed) {
      specialtyCodeToId[fixedCode] = existed.id;
      continue;
    }
    // Nếu chưa có, tạo mới với tên suy luận từ code
    const inferredName = fixedCode
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/([A-Z]+)/g, ' $1')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const created = await prisma.specialty.create({
      data: {
        specialtyCode: fixedCode,
        name: inferredName || fixedCode,
      },
    });
    specialtyCodeToId[fixedCode] = created.id;
  }

  const roomCodeToId: Record<string, string> = {};
  for (const r of clinicRoomsJson) {
    const code = (
      specialtyCodeFixMap[r.specialtyCode] ?? r.specialtyCode
    ).toUpperCase();
    const specialtyId = specialtyCodeToId[code];
    if (!specialtyId) continue;

    const existed = await prisma.clinicRoom.findUnique({
      where: { roomCode: r.roomCode },
    });
    const room = existed
      ? existed
      : await prisma.clinicRoom.create({
          data: {
            roomCode: r.roomCode,
            roomName: r.roomName,
            specialtyId,
            description: r.description ?? null,
            address: r.address ?? null,
          },
        });
    roomCodeToId[r.roomCode] = room.id;
  }

  // 3.2. Seed Booths
  type BoothJson = {
    roomCode: string;
    boothCode: string;
    name: string;
    isActive?: boolean;
  };
  const boothsJson: BoothJson[] = [
    {
      roomCode: 'NOI-101',
      boothCode: 'NOI-101-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NOI-101',
      boothCode: 'NOI-101-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NOI-101',
      boothCode: 'NOI-101-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NOI-102',
      boothCode: 'NOI-102-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NOI-102',
      boothCode: 'NOI-102-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NOI-102',
      boothCode: 'NOI-102-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NOI-103',
      boothCode: 'NOI-103-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NOI-103',
      boothCode: 'NOI-103-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NOI-103',
      boothCode: 'NOI-103-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NOI-104',
      boothCode: 'NOI-104-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NOI-104',
      boothCode: 'NOI-104-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NOI-104',
      boothCode: 'NOI-104-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'RHM-201',
      boothCode: 'RHM-201-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'RHM-201',
      boothCode: 'RHM-201-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'RHM-201',
      boothCode: 'RHM-201-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'RHM-202',
      boothCode: 'RHM-202-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'RHM-202',
      boothCode: 'RHM-202-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'RHM-202',
      boothCode: 'RHM-202-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'RHM-203',
      boothCode: 'RHM-203-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'RHM-203',
      boothCode: 'RHM-203-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'RHM-203',
      boothCode: 'RHM-203-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'RHM-204',
      boothCode: 'RHM-204-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'RHM-204',
      boothCode: 'RHM-204-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'RHM-204',
      boothCode: 'RHM-204-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'MAT-301',
      boothCode: 'MAT-301-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'MAT-301',
      boothCode: 'MAT-301-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'MAT-301',
      boothCode: 'MAT-301-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'MAT-302',
      boothCode: 'MAT-302-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'MAT-302',
      boothCode: 'MAT-302-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'MAT-302',
      boothCode: 'MAT-302-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'MAT-303',
      boothCode: 'MAT-303-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'MAT-303',
      boothCode: 'MAT-303-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'MAT-303',
      boothCode: 'MAT-303-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'MAT-304',
      boothCode: 'MAT-304-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'MAT-304',
      boothCode: 'MAT-304-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'MAT-304',
      boothCode: 'MAT-304-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NGO-401',
      boothCode: 'NGO-401-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NGO-401',
      boothCode: 'NGO-401-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NGO-401',
      boothCode: 'NGO-401-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NGO-402',
      boothCode: 'NGO-402-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NGO-402',
      boothCode: 'NGO-402-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NGO-402',
      boothCode: 'NGO-402-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NGO-403',
      boothCode: 'NGO-403-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NGO-403',
      boothCode: 'NGO-403-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NGO-403',
      boothCode: 'NGO-403-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NGO-404',
      boothCode: 'NGO-404-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NGO-404',
      boothCode: 'NGO-404-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NGO-404',
      boothCode: 'NGO-404-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'UBU-501',
      boothCode: 'UBU-501-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'UBU-501',
      boothCode: 'UBU-501-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'UBU-501',
      boothCode: 'UBU-501-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'UBU-502',
      boothCode: 'UBU-502-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'UBU-502',
      boothCode: 'UBU-502-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'UBU-502',
      boothCode: 'UBU-502-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'UBU-503',
      boothCode: 'UBU-503-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'UBU-503',
      boothCode: 'UBU-503-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'UBU-503',
      boothCode: 'UBU-503-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'UBU-504',
      boothCode: 'UBU-504-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'UBU-504',
      boothCode: 'UBU-504-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'UBU-504',
      boothCode: 'UBU-504-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TNN-601',
      boothCode: 'TNN-601-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TNN-601',
      boothCode: 'TNN-601-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TNN-601',
      boothCode: 'TNN-601-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TNN-602',
      boothCode: 'TNN-602-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TNN-602',
      boothCode: 'TNN-602-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TNN-602',
      boothCode: 'TNN-602-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TNN-603',
      boothCode: 'TNN-603-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TNN-603',
      boothCode: 'TNN-603-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TNN-603',
      boothCode: 'TNN-603-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TNN-604',
      boothCode: 'TNN-604-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TNN-604',
      boothCode: 'TNN-604-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TNN-604',
      boothCode: 'TNN-604-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NHI-701',
      boothCode: 'NHI-701-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NHI-701',
      boothCode: 'NHI-701-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NHI-701',
      boothCode: 'NHI-701-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NHI-702',
      boothCode: 'NHI-702-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NHI-702',
      boothCode: 'NHI-702-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NHI-702',
      boothCode: 'NHI-702-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NHI-703',
      boothCode: 'NHI-703-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NHI-703',
      boothCode: 'NHI-703-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NHI-703',
      boothCode: 'NHI-703-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NHI-704',
      boothCode: 'NHI-704-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NHI-704',
      boothCode: 'NHI-704-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NHI-704',
      boothCode: 'NHI-704-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'PHU-801',
      boothCode: 'PHU-801-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'PHU-801',
      boothCode: 'PHU-801-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'PHU-801',
      boothCode: 'PHU-801-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'PHU-802',
      boothCode: 'PHU-802-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'PHU-802',
      boothCode: 'PHU-802-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'PHU-802',
      boothCode: 'PHU-802-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'PHU-803',
      boothCode: 'PHU-803-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'PHU-803',
      boothCode: 'PHU-803-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'PHU-803',
      boothCode: 'PHU-803-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'PHU-804',
      boothCode: 'PHU-804-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'PHU-804',
      boothCode: 'PHU-804-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'PHU-804',
      boothCode: 'PHU-804-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'DAL-901',
      boothCode: 'DAL-901-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'DAL-901',
      boothCode: 'DAL-901-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'DAL-901',
      boothCode: 'DAL-901-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'DAL-902',
      boothCode: 'DAL-902-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'DAL-902',
      boothCode: 'DAL-902-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'DAL-902',
      boothCode: 'DAL-902-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'DAL-903',
      boothCode: 'DAL-903-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'DAL-903',
      boothCode: 'DAL-903-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'DAL-903',
      boothCode: 'DAL-903-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'DAL-904',
      boothCode: 'DAL-904-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'DAL-904',
      boothCode: 'DAL-904-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'DAL-904',
      boothCode: 'DAL-904-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'SAN-1001',
      boothCode: 'SAN-1001-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'SAN-1001',
      boothCode: 'SAN-1001-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'SAN-1001',
      boothCode: 'SAN-1001-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'SAN-1002',
      boothCode: 'SAN-1002-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'SAN-1002',
      boothCode: 'SAN-1002-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'SAN-1002',
      boothCode: 'SAN-1002-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'SAN-1003',
      boothCode: 'SAN-1003-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'SAN-1003',
      boothCode: 'SAN-1003-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'SAN-1003',
      boothCode: 'SAN-1003-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'SAN-1004',
      boothCode: 'SAN-1004-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'SAN-1004',
      boothCode: 'SAN-1004-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'SAN-1004',
      boothCode: 'SAN-1004-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TMH-1101',
      boothCode: 'TMH-1101-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TMH-1101',
      boothCode: 'TMH-1101-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TMH-1101',
      boothCode: 'TMH-1101-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TMH-1102',
      boothCode: 'TMH-1102-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TMH-1102',
      boothCode: 'TMH-1102-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TMH-1102',
      boothCode: 'TMH-1102-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TMH-1103',
      boothCode: 'TMH-1103-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TMH-1103',
      boothCode: 'TMH-1103-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TMH-1103',
      boothCode: 'TMH-1103-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TMH-1104',
      boothCode: 'TMH-1104-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TMH-1104',
      boothCode: 'TMH-1104-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TMH-1104',
      boothCode: 'TMH-1104-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'PHC-1201',
      boothCode: 'PHC-1201-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'PHC-1201',
      boothCode: 'PHC-1201-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'PHC-1201',
      boothCode: 'PHC-1201-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'PHC-1202',
      boothCode: 'PHC-1202-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'PHC-1202',
      boothCode: 'PHC-1202-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'PHC-1202',
      boothCode: 'PHC-1202-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'PHC-1203',
      boothCode: 'PHC-1203-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'PHC-1203',
      boothCode: 'PHC-1203-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'PHC-1203',
      boothCode: 'PHC-1203-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'PHC-1204',
      boothCode: 'PHC-1204-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'PHC-1204',
      boothCode: 'PHC-1204-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'PHC-1204',
      boothCode: 'PHC-1204-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'BON-1301',
      boothCode: 'BON-1301-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'BON-1301',
      boothCode: 'BON-1301-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'BON-1301',
      boothCode: 'BON-1301-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'BON-1302',
      boothCode: 'BON-1302-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'BON-1302',
      boothCode: 'BON-1302-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'BON-1302',
      boothCode: 'BON-1302-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'BON-1303',
      boothCode: 'BON-1303-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'BON-1303',
      boothCode: 'BON-1303-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'BON-1303',
      boothCode: 'BON-1303-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'BON-1304',
      boothCode: 'BON-1304-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'BON-1304',
      boothCode: 'BON-1304-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'BON-1304',
      boothCode: 'BON-1304-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'HUY-1401',
      boothCode: 'HUY-1401-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'HUY-1401',
      boothCode: 'HUY-1401-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'HUY-1401',
      boothCode: 'HUY-1401-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'HUY-1402',
      boothCode: 'HUY-1402-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'HUY-1402',
      boothCode: 'HUY-1402-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'HUY-1402',
      boothCode: 'HUY-1402-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'HUY-1403',
      boothCode: 'HUY-1403-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'HUY-1403',
      boothCode: 'HUY-1403-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'HUY-1403',
      boothCode: 'HUY-1403-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'HUY-1404',
      boothCode: 'HUY-1404-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'HUY-1404',
      boothCode: 'HUY-1404-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'HUY-1404',
      boothCode: 'HUY-1404-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TAM-1501',
      boothCode: 'TAM-1501-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TAM-1501',
      boothCode: 'TAM-1501-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TAM-1501',
      boothCode: 'TAM-1501-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TAM-1502',
      boothCode: 'TAM-1502-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TAM-1502',
      boothCode: 'TAM-1502-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TAM-1502',
      boothCode: 'TAM-1502-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TAM-1503',
      boothCode: 'TAM-1503-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TAM-1503',
      boothCode: 'TAM-1503-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TAM-1503',
      boothCode: 'TAM-1503-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'TAM-1504',
      boothCode: 'TAM-1504-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'TAM-1504',
      boothCode: 'TAM-1504-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'TAM-1504',
      boothCode: 'TAM-1504-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NTC-1601',
      boothCode: 'NTC-1601-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NTC-1601',
      boothCode: 'NTC-1601-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NTC-1601',
      boothCode: 'NTC-1601-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NTC-1602',
      boothCode: 'NTC-1602-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NTC-1602',
      boothCode: 'NTC-1602-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NTC-1602',
      boothCode: 'NTC-1602-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NTC-1603',
      boothCode: 'NTC-1603-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NTC-1603',
      boothCode: 'NTC-1603-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NTC-1603',
      boothCode: 'NTC-1603-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'NTC-1604',
      boothCode: 'NTC-1604-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'NTC-1604',
      boothCode: 'NTC-1604-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'NTC-1604',
      boothCode: 'NTC-1604-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'CHU-1801',
      boothCode: 'CHU-1801-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'CHU-1801',
      boothCode: 'CHU-1801-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'CHU-1801',
      boothCode: 'CHU-1801-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'CHU-1802',
      boothCode: 'CHU-1802-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'CHU-1802',
      boothCode: 'CHU-1802-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'CHU-1802',
      boothCode: 'CHU-1802-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'CHU-1803',
      boothCode: 'CHU-1803-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'CHU-1803',
      boothCode: 'CHU-1803-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'CHU-1803',
      boothCode: 'CHU-1803-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'CHU-1804',
      boothCode: 'CHU-1804-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'CHU-1804',
      boothCode: 'CHU-1804-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'CHU-1804',
      boothCode: 'CHU-1804-B3',
      name: 'Buồng 3',
      isActive: true,
    },
    {
      roomCode: 'CT-1901',
      boothCode: 'CT-1901-B1',
      name: 'Buồng 1',
      isActive: true,
    },
    {
      roomCode: 'CT-1901',
      boothCode: 'CT-1901-B2',
      name: 'Buồng 2',
      isActive: true,
    },
    {
      roomCode: 'CT-1901',
      boothCode: 'CT-1901-B3',
      name: 'Buồng 3',
      isActive: true,
    },
  ];
  for (const b of boothsJson) {
    const roomId = roomCodeToId[b.roomCode];
    if (!roomId) continue;
    const existed = await prisma.booth.findUnique({
      where: { boothCode: b.boothCode },
    });
    if (existed) continue;
    await prisma.booth.create({
      data: {
        boothCode: b.boothCode,
        name: b.name,
        roomId,
        isActive: b.isActive ?? true,
      },
    });
  }

  // 3.3. Seed Services và liên kết với ClinicRooms
  type ServiceJson = {
    serviceCode: string;
    name: string;
    price?: number;
    timePerPatient?: number;
    description?: string;
    rooms?: string[]; // roomCode list
  };
  const servicesJson: ServiceJson[] = [
    {
      serviceCode: 'CONSULT_STD',
      name: 'Khám nội tổng quát (lần đầu)',
      price: 120000.0,
      timePerPatient: 15,
      description: 'Khám lâm sàng, chẩn đoán sơ bộ, chỉ định nếu cần.',
      rooms: ['NOI-101', 'NOI-102', 'NOI-103', 'NOI-104'],
    },
    {
      serviceCode: 'FOLLOW_UP',
      name: 'Tái khám nội',
      price: 80000.0,
      timePerPatient: 10,
      description: 'Đánh giá đáp ứng điều trị, chỉnh thuốc.',
      rooms: ['NOI-101', 'NOI-102', 'NOI-103', 'NOI-104'],
    },
    {
      serviceCode: 'CHRONIC_MGMT',
      name: 'Quản lý bệnh mạn (THA/ĐTĐ/COPD...)',
      price: 150000.0,
      timePerPatient: 20,
      description: 'Theo dõi định kỳ và tư vấn lối sống.',
      rooms: ['NOI-101', 'NOI-102', 'NOI-104'],
    },
    {
      serviceCode: 'BP_CHECK',
      name: 'Đo huyết áp và tư vấn',
      price: 30000.0,
      timePerPatient: 5,
      description: 'Đo HA, tư vấn theo dõi tại nhà.',
      rooms: ['NOI-101', 'NOI-102', 'NOI-103'],
    },
    {
      serviceCode: 'IM_INJECTION',
      name: 'Tiêm bắp',
      price: 50000.0,
      timePerPatient: 5,
      description: 'Tiêm bắp theo y lệnh.',
      rooms: ['NOI-101', 'NOI-102', 'NOI-103'],
    },
    {
      serviceCode: 'IV_INSERT',
      name: 'Đặt đường truyền tĩnh mạch',
      price: 70000.0,
      timePerPatient: 10,
      description: 'Thiết lập đường truyền TM ngoại biên.',
      rooms: ['NOI-101', 'NOI-102'],
    },
    {
      serviceCode: 'NEBULIZE',
      name: 'Khí dung (giãn phế quản)',
      price: 60000.0,
      timePerPatient: 15,
      description: 'Khí dung theo chỉ định cho bệnh lý hô hấp.',
      rooms: ['NOI-101', 'NOI-102', 'NOI-104'],
    },
    {
      serviceCode: 'DENTAL_EXAM',
      name: 'Khám răng hàm mặt',
      price: 100000.0,
      timePerPatient: 15,
      description: 'Khám tổng quát răng, hàm, mặt và tư vấn điều trị.',
      rooms: ['RHM-201', 'RHM-202', 'RHM-203', 'RHM-204'],
    },
    {
      serviceCode: 'TOOTH_EXTRA',
      name: 'Nhổ răng',
      price: 200000.0,
      timePerPatient: 20,
      description: 'Nhổ răng vĩnh viễn hoặc răng sữa theo chỉ định.',
      rooms: ['RHM-201', 'RHM-202'],
    },
    {
      serviceCode: 'DENT_FILL',
      name: 'Trám răng',
      price: 250000.0,
      timePerPatient: 30,
      description: 'Trám phục hồi răng sâu, răng mẻ.',
      rooms: ['RHM-201', 'RHM-202'],
    },
    {
      serviceCode: 'DENT_SCALING',
      name: 'Cạo vôi răng',
      price: 180000.0,
      timePerPatient: 25,
      description: 'Làm sạch mảng bám, vôi răng bằng máy siêu âm.',
      rooms: ['RHM-201', 'RHM-202'],
    },
    {
      serviceCode: 'TEETH_WHITEN',
      name: 'Tẩy trắng răng',
      price: 1200000.0,
      timePerPatient: 45,
      description: 'Làm trắng răng bằng hoá chất và đèn plasma.',
      rooms: ['RHM-202'],
    },
    {
      serviceCode: 'ORTHO_CONS',
      name: 'Tư vấn chỉnh nha',
      price: 150000.0,
      timePerPatient: 20,
      description:
        'Khám và tư vấn kế hoạch niềng răng, chỉnh hình răng hàm mặt.',
      rooms: ['RHM-203'],
    },
    {
      serviceCode: 'ORTHO_BRACE',
      name: 'Niềng răng (mỗi lần tái khám)',
      price: 500000.0,
      timePerPatient: 30,
      description: 'Điều chỉnh mắc cài hoặc khay niềng theo phác đồ.',
      rooms: ['RHM-203'],
    },
    {
      serviceCode: 'MAX_SURGERY',
      name: 'Phẫu thuật hàm mặt',
      price: 5000000.0,
      timePerPatient: 120,
      description: 'Phẫu thuật chỉnh hình, u nang, chấn thương hàm mặt.',
      rooms: ['RHM-204'],
    },
    {
      serviceCode: 'WISDOM_EXT',
      name: 'Nhổ răng khôn',
      price: 800000.0,
      timePerPatient: 45,
      description: 'Tiểu phẫu nhổ răng số 8 (răng khôn).',
      rooms: ['RHM-204'],
    },
    {
      serviceCode: 'EYE_EXAM',
      name: 'Khám mắt tổng quát',
      price: 120000.0,
      timePerPatient: 15,
      description: 'Khám thị lực, soi đèn khe, kiểm tra tình trạng mắt.',
      rooms: ['MAT-301', 'MAT-302', 'MAT-303', 'MAT-304'],
    },
    {
      serviceCode: 'REFRACT_TEST',
      name: 'Đo khúc xạ',
      price: 100000.0,
      timePerPatient: 10,
      description: 'Đo tật khúc xạ bằng máy tự động và test kính.',
      rooms: ['MAT-302'],
    },
    {
      serviceCode: 'FUNDUS_EXAM',
      name: 'Soi đáy mắt',
      price: 150000.0,
      timePerPatient: 15,
      description: 'Kiểm tra võng mạc, thần kinh thị giác, mạch máu.',
      rooms: ['MAT-301', 'MAT-303'],
    },
    {
      serviceCode: 'EYE_TREAT_CONJ',
      name: 'Điều trị viêm kết mạc',
      price: 80000.0,
      timePerPatient: 10,
      description: 'Chẩn đoán và điều trị viêm kết mạc cấp/mạn.',
      rooms: ['MAT-303'],
    },
    {
      serviceCode: 'FOREIGN_REM',
      name: 'Lấy dị vật mắt',
      price: 200000.0,
      timePerPatient: 20,
      description: 'Lấy dị vật kết mạc, giác mạc dưới kính hiển vi.',
      rooms: ['MAT-303'],
    },
    {
      serviceCode: 'CATARACT_SURG',
      name: 'Phẫu thuật đục thủy tinh thể',
      price: 7000000.0,
      timePerPatient: 90,
      description: 'Phẫu thuật thay thủy tinh thể nhân tạo (Phaco).',
      rooms: ['MAT-304'],
    },
    {
      serviceCode: 'LASIK_SURG',
      name: 'Phẫu thuật tật khúc xạ (LASIK/SMILE)',
      price: 15000000.0,
      timePerPatient: 60,
      description: 'Sửa cận thị, viễn thị, loạn thị bằng laser.',
      rooms: ['MAT-304'],
    },
    {
      serviceCode: 'GLAUCOMA_TREAT',
      name: 'Điều trị glôcôm',
      price: 300000.0,
      timePerPatient: 20,
      description: 'Khám, dùng thuốc, theo dõi nhãn áp.',
      rooms: ['MAT-303'],
    },
    {
      serviceCode: 'SURG_EXAM',
      name: 'Khám ngoại khoa',
      price: 150000.0,
      timePerPatient: 15,
      description:
        'Khám tổng quát các bệnh ngoại khoa (u, thoát vị, chấn thương...).',
      rooms: ['NGO-401', 'NGO-404'],
    },
    {
      serviceCode: 'MINOR_SURG',
      name: 'Tiểu phẫu ngoại khoa',
      price: 500000.0,
      timePerPatient: 40,
      description: 'Các thủ thuật nhỏ như cắt u bã, rạch áp xe, cắt u mỡ.',
      rooms: ['NGO-402'],
    },
    {
      serviceCode: 'STITCH_REM',
      name: 'Cắt chỉ vết thương',
      price: 80000.0,
      timePerPatient: 10,
      description: 'Cắt chỉ sau phẫu thuật hoặc chấn thương.',
      rooms: ['NGO-402', 'NGO-403'],
    },
    {
      serviceCode: 'WOUND_CARE',
      name: 'Chăm sóc vết thương',
      price: 100000.0,
      timePerPatient: 20,
      description: 'Thay băng, rửa vết thương, xử trí vết thương phần mềm.',
      rooms: ['NGO-402', 'NGO-403'],
    },
    {
      serviceCode: 'POST_OP_FOLLOW',
      name: 'Khám hậu phẫu',
      price: 120000.0,
      timePerPatient: 15,
      description: 'Đánh giá kết quả mổ, kiểm tra biến chứng sau mổ.',
      rooms: ['NGO-403'],
    },
    {
      serviceCode: 'SURG_CONSULT',
      name: 'Tư vấn phẫu thuật',
      price: 100000.0,
      timePerPatient: 20,
      description: 'Giải thích chỉ định, nguy cơ, tiên lượng trước mổ.',
      rooms: ['NGO-404'],
    },
    {
      serviceCode: 'PRE_OP_CHECK',
      name: 'Khám tiền phẫu',
      price: 200000.0,
      timePerPatient: 30,
      description:
        'Đánh giá toàn thân, xét nghiệm, chuẩn bị bệnh nhân trước mổ.',
      rooms: ['NGO-401', 'NGO-404'],
    },
    {
      serviceCode: 'ONCO_EXAM',
      name: 'Khám ung bướu',
      price: 200000.0,
      timePerPatient: 20,
      description: 'Khám lâm sàng phát hiện, theo dõi bệnh nhân ung bướu.',
      rooms: ['UBU-501', 'UBU-504'],
    },
    {
      serviceCode: 'BIOPSY_PROC',
      name: 'Sinh thiết khối u',
      price: 1200000.0,
      timePerPatient: 45,
      description: 'Lấy mẫu mô u để chẩn đoán giải phẫu bệnh.',
      rooms: ['UBU-501'],
    },
    {
      serviceCode: 'CHEMO_SESSION',
      name: 'Truyền hóa chất (1 chu kỳ)',
      price: 2500000.0,
      timePerPatient: 120,
      description: 'Truyền thuốc hóa chất theo phác đồ.',
      rooms: ['UBU-502'],
    },
    {
      serviceCode: 'CHEMO_CARE',
      name: 'Theo dõi & xử trí tác dụng phụ hóa trị',
      price: 300000.0,
      timePerPatient: 30,
      description: 'Theo dõi sau hóa trị, xử trí buồn nôn, giảm bạch cầu…',
      rooms: ['UBU-502'],
    },
    {
      serviceCode: 'RADIATION_PLAN',
      name: 'Lập kế hoạch xạ trị',
      price: 2000000.0,
      timePerPatient: 60,
      description: 'Xác định liều, trường chiếu, mô phỏng xạ trị.',
      rooms: ['UBU-503'],
    },
    {
      serviceCode: 'RADIATION_SESS',
      name: 'Buổi xạ trị',
      price: 1500000.0,
      timePerPatient: 30,
      description: 'Thực hiện chiếu xạ theo kế hoạch điều trị.',
      rooms: ['UBU-503'],
    },
    {
      serviceCode: 'PALLIATIVE',
      name: 'Chăm sóc giảm nhẹ',
      price: 200000.0,
      timePerPatient: 25,
      description: 'Điều trị triệu chứng nâng cao chất lượng cuộc sống.',
      rooms: ['UBU-504'],
    },
    {
      serviceCode: 'ONCO_COUNSEL',
      name: 'Tư vấn điều trị ung thư',
      price: 150000.0,
      timePerPatient: 20,
      description: 'Giải thích phác đồ, tiên lượng, lựa chọn điều trị.',
      rooms: ['UBU-504'],
    },
    {
      serviceCode: 'INF_EXAM',
      name: 'Khám bệnh truyền nhiễm',
      price: 150000.0,
      timePerPatient: 20,
      description:
        'Khám, chẩn đoán các bệnh truyền nhiễm như sốt xuất huyết, viêm gan, HIV.',
      rooms: ['TNN-601', 'TNN-603'],
    },
    {
      serviceCode: 'ISOLATION_CARE',
      name: 'Theo dõi cách ly',
      price: 250000.0,
      timePerPatient: 30,
      description: 'Theo dõi, điều trị bệnh nhân trong phòng cách ly.',
      rooms: ['TNN-602'],
    },
    {
      serviceCode: 'FEVER_TREAT',
      name: 'Điều trị sốt và nhiễm trùng thông thường',
      price: 120000.0,
      timePerPatient: 15,
      description: 'Xử trí sốt cao, nhiễm trùng hô hấp, tiêu hóa…',
      rooms: ['TNN-601', 'TNN-603'],
    },
    {
      serviceCode: 'HIV_COUNSEL',
      name: 'Tư vấn & điều trị HIV/AIDS',
      price: 180000.0,
      timePerPatient: 25,
      description: 'Khám, kê thuốc ARV, tư vấn dự phòng lây nhiễm.',
      rooms: ['TNN-603'],
    },
    {
      serviceCode: 'HEPATITIS_CARE',
      name: 'Khám & theo dõi viêm gan virus',
      price: 200000.0,
      timePerPatient: 20,
      description: 'Theo dõi điều trị viêm gan B, C.',
      rooms: ['TNN-601', 'TNN-603'],
    },
    {
      serviceCode: 'SAMPLE_TEST',
      name: 'Lấy mẫu xét nghiệm bệnh truyền nhiễm',
      price: 100000.0,
      timePerPatient: 10,
      description: 'Lấy mẫu máu, dịch tiết, phân để xét nghiệm chẩn đoán.',
      rooms: ['TNN-604'],
    },
    {
      serviceCode: 'LAB_RECEIVE',
      name: 'Tiếp nhận & chuyển mẫu xét nghiệm',
      price: 50000.0,
      timePerPatient: 5,
      description:
        'Tiếp nhận, ghi nhận và chuyển mẫu xét nghiệm đến phòng labo.',
      rooms: ['TNN-604'],
    },
    {
      serviceCode: 'PED_EXAM',
      name: 'Khám nhi tổng quát',
      price: 150000.0,
      timePerPatient: 20,
      description:
        'Khám sức khỏe tổng quát cho trẻ em, chẩn đoán bệnh thường gặp.',
      rooms: ['NHI-701', 'NHI-703'],
    },
    {
      serviceCode: 'PED_VACCINE',
      name: 'Tiêm chủng vaccine',
      price: 250000.0,
      timePerPatient: 15,
      description: 'Thực hiện tiêm chủng vaccine phòng bệnh cho trẻ.',
      rooms: ['NHI-702'],
    },
    {
      serviceCode: 'PED_FEVERCARE',
      name: 'Theo dõi & điều trị sốt',
      price: 120000.0,
      timePerPatient: 15,
      description: 'Theo dõi trẻ sốt cao, xử trí hạ sốt, theo dõi biến chứng.',
      rooms: ['NHI-703'],
    },
    {
      serviceCode: 'PED_ASTHMA',
      name: 'Điều trị hen phế quản trẻ em',
      price: 180000.0,
      timePerPatient: 25,
      description: 'Khí dung, thuốc giãn phế quản, theo dõi hen ở trẻ.',
      rooms: ['NHI-701', 'NHI-703'],
    },
    {
      serviceCode: 'NUTRI_COUNSEL',
      name: 'Tư vấn dinh dưỡng nhi khoa',
      price: 100000.0,
      timePerPatient: 20,
      description: 'Tư vấn chế độ ăn, nuôi con bằng sữa mẹ, bổ sung vi chất.',
      rooms: ['NHI-704'],
    },
    {
      serviceCode: 'GROWTH_CHECK',
      name: 'Theo dõi tăng trưởng & phát triển',
      price: 90000.0,
      timePerPatient: 15,
      description: 'Đo chiều cao, cân nặng, đánh giá biểu đồ tăng trưởng.',
      rooms: ['NHI-701', 'NHI-704'],
    },
    {
      serviceCode: 'PED_DEVCOUNSEL',
      name: 'Tư vấn phát triển tâm lý - vận động',
      price: 120000.0,
      timePerPatient: 20,
      description:
        'Đánh giá vận động, ngôn ngữ, hành vi; tư vấn can thiệp sớm.',
      rooms: ['NHI-704'],
    },
    {
      serviceCode: 'GYNE_EXAM',
      name: 'Khám phụ khoa',
      price: 150000.0,
      timePerPatient: 20,
      description:
        'Khám lâm sàng phụ khoa, phát hiện viêm nhiễm, u nang, bệnh lý sinh sản.',
      rooms: ['PHU-801', 'PHU-803'],
    },
    {
      serviceCode: 'GYNE_US',
      name: 'Siêu âm phụ khoa',
      price: 200000.0,
      timePerPatient: 15,
      description: 'Siêu âm tử cung, buồng trứng, phát hiện u xơ, nang.',
      rooms: ['PHU-802'],
    },
    {
      serviceCode: 'GYNE_INFECTION',
      name: 'Điều trị viêm nhiễm phụ khoa',
      price: 180000.0,
      timePerPatient: 20,
      description: 'Điều trị viêm âm đạo, cổ tử cung, nấm, khí hư bất thường.',
      rooms: ['PHU-803'],
    },
    {
      serviceCode: 'GYNE_PAP',
      name: 'Xét nghiệm Pap smear',
      price: 250000.0,
      timePerPatient: 10,
      description: 'Tầm soát ung thư cổ tử cung bằng tế bào học.',
      rooms: ['PHU-801', 'PHU-803'],
    },
    {
      serviceCode: 'GYNE_IUD',
      name: 'Đặt vòng tránh thai (IUD)',
      price: 500000.0,
      timePerPatient: 30,
      description: 'Đặt dụng cụ tử cung tránh thai, tư vấn theo dõi.',
      rooms: ['PHU-804'],
    },
    {
      serviceCode: 'GYNE_FERTILITY',
      name: 'Tư vấn sinh sản',
      price: 200000.0,
      timePerPatient: 20,
      description: 'Tư vấn hiếm muộn, kế hoạch sinh con, điều trị hỗ trợ.',
      rooms: ['PHU-804'],
    },
    {
      serviceCode: 'GYNE_PLANCOUNSEL',
      name: 'Tư vấn kế hoạch hóa gia đình',
      price: 120000.0,
      timePerPatient: 15,
      description: 'Tư vấn biện pháp tránh thai, chăm sóc sức khỏe sinh sản.',
      rooms: ['PHU-804'],
    },
    {
      serviceCode: 'DERM_EXAM',
      name: 'Khám da liễu',
      price: 150000.0,
      timePerPatient: 20,
      description:
        'Khám tổng quát các bệnh ngoài da: viêm da, nấm, mề đay, vảy nến...',
      rooms: ['DAL-901', 'DAL-904'],
    },
    {
      serviceCode: 'ACNE_TREAT',
      name: 'Điều trị mụn',
      price: 250000.0,
      timePerPatient: 30,
      description:
        'Điều trị mụn trứng cá bằng thuốc và thủ thuật (nặn mụn, peel).',
      rooms: ['DAL-902'],
    },
    {
      serviceCode: 'MELASMA_TREAT',
      name: 'Điều trị nám, tàn nhang',
      price: 500000.0,
      timePerPatient: 40,
      description: 'Điều trị bằng laser, peel da hóa học hoặc thuốc bôi.',
      rooms: ['DAL-902'],
    },
    {
      serviceCode: 'SCAR_TREAT',
      name: 'Điều trị sẹo lồi/lõm',
      price: 800000.0,
      timePerPatient: 45,
      description: 'Tiêm thuốc, laser hoặc lăn kim vi điểm điều trị sẹo.',
      rooms: ['DAL-902', 'DAL-903'],
    },
    {
      serviceCode: 'DERM_PROC',
      name: 'Thủ thuật da liễu',
      price: 400000.0,
      timePerPatient: 30,
      description:
        'Đốt laser, cắt đốt u nhú, lấy nốt ruồi, điều trị sùi mào gà...',
      rooms: ['DAL-903'],
    },
    {
      serviceCode: 'LASER_TREAT',
      name: 'Điều trị bằng laser thẩm mỹ',
      price: 1200000.0,
      timePerPatient: 60,
      description:
        'Laser CO2, Fractional, Q-Switched cho các bệnh lý và thẩm mỹ da.',
      rooms: ['DAL-903'],
    },
    {
      serviceCode: 'DERM_COUNSEL',
      name: 'Tư vấn chăm sóc da',
      price: 100000.0,
      timePerPatient: 15,
      description:
        'Tư vấn dưỡng da, lựa chọn mỹ phẩm, phòng ngừa bệnh da liễu.',
      rooms: ['DAL-904'],
    },
    {
      serviceCode: 'OB_ANTENATAL',
      name: 'Khám thai định kỳ',
      price: 200000.0,
      timePerPatient: 20,
      description:
        'Khám lâm sàng thai phụ, đo tim thai, tư vấn theo dõi thai kỳ.',
      rooms: ['SAN-1001', 'SAN-1003'],
    },
    {
      serviceCode: 'OB_US',
      name: 'Siêu âm thai',
      price: 300000.0,
      timePerPatient: 20,
      description:
        'Siêu âm thai 2D/3D/4D, theo dõi phát triển và dị tật bẩm sinh.',
      rooms: ['SAN-1002'],
    },
    {
      serviceCode: 'OB_LABORSIM',
      name: 'Tư vấn sinh thường / sinh mổ',
      price: 150000.0,
      timePerPatient: 15,
      description:
        'Giải thích quy trình sinh thường, sinh mổ, tiên lượng cuộc sinh.',
      rooms: ['SAN-1003'],
    },
    {
      serviceCode: 'OB_PRECOUNSEL',
      name: 'Tư vấn tiền sản',
      price: 180000.0,
      timePerPatient: 20,
      description:
        'Tư vấn dinh dưỡng, luyện tập, chuẩn bị tâm lý trước khi sinh.',
      rooms: ['SAN-1003'],
    },
    {
      serviceCode: 'OB_POSTCARE',
      name: 'Theo dõi hậu sản',
      price: 200000.0,
      timePerPatient: 20,
      description:
        'Khám và theo dõi sức khỏe mẹ sau sinh, kiểm tra vết mổ/tầng sinh môn.',
      rooms: ['SAN-1004'],
    },
    {
      serviceCode: 'OB_LACTCOUNSEL',
      name: 'Tư vấn nuôi con bằng sữa mẹ',
      price: 120000.0,
      timePerPatient: 15,
      description: 'Hướng dẫn cho bú, duy trì và tăng tiết sữa mẹ.',
      rooms: ['SAN-1004'],
    },
    {
      serviceCode: 'OB_FAMPLAN',
      name: 'Tư vấn kế hoạch hóa sau sinh',
      price: 100000.0,
      timePerPatient: 15,
      description: 'Tư vấn tránh thai, chăm sóc sức khỏe sinh sản sau sinh.',
      rooms: ['SAN-1004'],
    },
    {
      serviceCode: 'ENT_EXAM',
      name: 'Khám tai mũi họng',
      price: 150000.0,
      timePerPatient: 20,
      description:
        'Khám các bệnh lý tai, mũi, họng thông thường: viêm họng, viêm xoang, viêm tai.',
      rooms: ['TMH-1101', 'TMH-1103', 'TMH-1104'],
    },
    {
      serviceCode: 'ENT_ENDO',
      name: 'Nội soi tai mũi họng',
      price: 250000.0,
      timePerPatient: 20,
      description:
        'Nội soi bằng ống mềm/cứng để chẩn đoán bệnh lý mũi xoang, thanh quản.',
      rooms: ['TMH-1102'],
    },
    {
      serviceCode: 'ENT_FOREIGN',
      name: 'Lấy dị vật tai – mũi – họng',
      price: 300000.0,
      timePerPatient: 25,
      description: 'Loại bỏ dị vật mắc ở tai, mũi hoặc họng.',
      rooms: ['TMH-1101', 'TMH-1103'],
    },
    {
      serviceCode: 'ENT_TONSIL',
      name: 'Điều trị viêm amidan',
      price: 200000.0,
      timePerPatient: 15,
      description:
        'Điều trị viêm amidan cấp và mạn bằng thuốc hoặc đốt lạnh/laser.',
      rooms: ['TMH-1103'],
    },
    {
      serviceCode: 'ENT_SINUS',
      name: 'Điều trị viêm xoang',
      price: 250000.0,
      timePerPatient: 20,
      description: 'Điều trị viêm xoang mạn tính, rửa xoang.',
      rooms: ['TMH-1103'],
    },
    {
      serviceCode: 'ENT_HEARTEST',
      name: 'Đo thính lực',
      price: 200000.0,
      timePerPatient: 20,
      description: 'Đo và đánh giá sức nghe, phát hiện sớm suy giảm thính lực.',
      rooms: ['TMH-1102', 'TMH-1103'],
    },
    {
      serviceCode: 'ENT_COUNSEL',
      name: 'Tư vấn tai mũi họng',
      price: 100000.0,
      timePerPatient: 15,
      description:
        'Tư vấn phòng bệnh, chăm sóc sau phẫu thuật TMH, vệ sinh tai mũi họng.',
      rooms: ['TMH-1104'],
    },
    {
      serviceCode: 'REHAB_EXAM',
      name: 'Khám phục hồi chức năng',
      price: 150000.0,
      timePerPatient: 20,
      description:
        'Khám, đánh giá nhu cầu phục hồi chức năng sau bệnh lý, chấn thương.',
      rooms: ['PHC-1201'],
    },
    {
      serviceCode: 'PHYSIO_SESS',
      name: 'Buổi vật lý trị liệu',
      price: 200000.0,
      timePerPatient: 30,
      description:
        'Điện trị liệu, nhiệt trị liệu, siêu âm trị liệu, tập vận động.',
      rooms: ['PHC-1202'],
    },
    {
      serviceCode: 'MASSAGE_THER',
      name: 'Xoa bóp trị liệu',
      price: 120000.0,
      timePerPatient: 25,
      description: 'Xoa bóp – bấm huyệt phục hồi vận động, giảm đau.',
      rooms: ['PHC-1202'],
    },
    {
      serviceCode: 'SPEECH_THER',
      name: 'Âm ngữ trị liệu',
      price: 180000.0,
      timePerPatient: 30,
      description: 'Can thiệp rối loạn ngôn ngữ, phát âm, chậm nói.',
      rooms: ['PHC-1203'],
    },
    {
      serviceCode: 'SWALLOW_REHAB',
      name: 'Tập nuốt',
      price: 150000.0,
      timePerPatient: 20,
      description:
        'Hướng dẫn và tập luyện phục hồi chức năng nuốt sau tai biến.',
      rooms: ['PHC-1203'],
    },
    {
      serviceCode: 'OCCUP_THER',
      name: 'Hoạt động trị liệu',
      price: 170000.0,
      timePerPatient: 30,
      description:
        'Luyện tập hoạt động hàng ngày, kỹ năng sống cho người khuyết tật.',
      rooms: ['PHC-1204'],
    },
    {
      serviceCode: 'HAND_REHAB',
      name: 'Phục hồi chức năng bàn tay',
      price: 200000.0,
      timePerPatient: 25,
      description:
        'Tập vận động tinh, khéo léo bàn tay sau chấn thương hoặc đột quỵ.',
      rooms: ['PHC-1204'],
    },
    {
      serviceCode: 'BURN_EXAM',
      name: 'Khám & phân độ bỏng',
      price: 180000.0,
      timePerPatient: 20,
      description:
        'Đánh giá diện tích (TBSA), độ sâu bỏng, vị trí, biến chứng kèm theo.',
      rooms: ['BON-1301'],
    },
    {
      serviceCode: 'BURN_DEBRIDE',
      name: 'Cắt lọc mô hoại tử (debridement) mức độ nhẹ',
      price: 350000.0,
      timePerPatient: 30,
      description:
        'Cắt lọc mô hoại tử nông, làm sạch vết bỏng tại phòng thủ thuật.',
      rooms: ['BON-1302'],
    },
    {
      serviceCode: 'BURN_DRESS',
      name: 'Thay băng vết bỏng',
      price: 150000.0,
      timePerPatient: 20,
      description:
        'Rửa vết thương, bôi thuốc, thay băng vô khuẩn theo phác đồ.',
      rooms: ['BON-1302', 'BON-1303'],
    },
    {
      serviceCode: 'BURN_PAIN',
      name: 'Kiểm soát đau trong bỏng',
      price: 120000.0,
      timePerPatient: 15,
      description: 'Đánh giá và kê đơn giảm đau đa mô thức cho bệnh nhân bỏng.',
      rooms: ['BON-1301', 'BON-1303'],
    },
    {
      serviceCode: 'BURN_INFECT',
      name: 'Xử trí nhiễm trùng vết bỏng',
      price: 200000.0,
      timePerPatient: 20,
      description:
        'Đánh giá nhiễm trùng, lấy mẫu cấy (nếu cần), điều chỉnh kháng sinh.',
      rooms: ['BON-1301', 'BON-1303'],
    },
    {
      serviceCode: 'BURN_GRAFT_FUP',
      name: 'Theo dõi ghép da sau bỏng',
      price: 220000.0,
      timePerPatient: 20,
      description:
        'Đánh giá bám mảnh ghép, tưới máu, chăm sóc vùng cho – nhận.',
      rooms: ['BON-1303'],
    },
    {
      serviceCode: 'BURN_SCAR',
      name: 'Quản lý sẹo sau bỏng',
      price: 300000.0,
      timePerPatient: 25,
      description:
        'Nén ép, băng silicone, tiêm thuốc nội tổn thương, hướng dẫn tập vận động.',
      rooms: ['BON-1303', 'BON-1304'],
    },
    {
      serviceCode: 'BURN_COUNSEL',
      name: 'Tư vấn chăm sóc & dinh dưỡng cho bệnh nhân bỏng',
      price: 120000.0,
      timePerPatient: 15,
      description:
        'Hướng dẫn chăm sóc tại nhà, dinh dưỡng giàu năng lượng – protein.',
      rooms: ['BON-1304'],
    },
    {
      serviceCode: 'BURN_TETANUS',
      name: 'Dự phòng uốn ván (tiêm/nhắc)',
      price: 80000.0,
      timePerPatient: 10,
      description:
        'Đánh giá chỉ định và tiêm phòng/nhắc uốn ván theo khuyến cáo.',
      rooms: ['BON-1301', 'BON-1302'],
    },
    {
      serviceCode: 'HEM_EXAM',
      name: 'Khám huyết học',
      price: 150000.0,
      timePerPatient: 20,
      description:
        'Khám các bệnh lý huyết học: thiếu máu, bạch cầu, tiểu cầu, đông máu.',
      rooms: ['HUY-1401'],
    },
    {
      serviceCode: 'CBC_TEST',
      name: 'Xét nghiệm công thức máu (CBC)',
      price: 90000.0,
      timePerPatient: 10,
      description: 'Đo hồng cầu, bạch cầu, tiểu cầu, hemoglobin.',
      rooms: ['HUY-1403'],
    },
    {
      serviceCode: 'COAG_TEST',
      name: 'Xét nghiệm đông máu',
      price: 120000.0,
      timePerPatient: 15,
      description: 'Xét nghiệm PT, APTT, INR để đánh giá rối loạn đông máu.',
      rooms: ['HUY-1403'],
    },
    {
      serviceCode: 'BLOOD_TYP',
      name: 'Xét nghiệm nhóm máu',
      price: 70000.0,
      timePerPatient: 10,
      description: 'Xác định nhóm máu ABO, Rh(D).',
      rooms: ['HUY-1403'],
    },
    {
      serviceCode: 'TRANSFUSION',
      name: 'Truyền máu',
      price: 500000.0,
      timePerPatient: 120,
      description:
        'Truyền máu toàn phần hoặc các chế phẩm máu, theo dõi trong khi truyền.',
      rooms: ['HUY-1402'],
    },
    {
      serviceCode: 'TRANSF_MON',
      name: 'Theo dõi biến chứng truyền máu',
      price: 150000.0,
      timePerPatient: 30,
      description: 'Theo dõi và xử trí phản ứng dị ứng, sốt, sốc phản vệ.',
      rooms: ['HUY-1402'],
    },
    {
      serviceCode: 'HEM_COUNSEL',
      name: 'Tư vấn huyết học',
      price: 100000.0,
      timePerPatient: 15,
      description: 'Giải thích kết quả xét nghiệm, định hướng điều trị.',
      rooms: ['HUY-1401', 'HUY-1404'],
    },
    {
      serviceCode: 'BLOOD_DON',
      name: 'Tư vấn & tiếp nhận hiến máu',
      price: 0.0,
      timePerPatient: 20,
      description: 'Tư vấn, kiểm tra sức khỏe, tiếp nhận máu từ người hiến.',
      rooms: ['HUY-1404'],
    },
    {
      serviceCode: 'PSY_EXAM',
      name: 'Khám tâm thần',
      price: 200000.0,
      timePerPatient: 30,
      description:
        'Khám, chẩn đoán các rối loạn tâm thần: trầm cảm, lo âu, tâm thần phân liệt...',
      rooms: ['TAM-1501'],
    },
    {
      serviceCode: 'PSY_TEST',
      name: 'Trắc nghiệm tâm lý',
      price: 250000.0,
      timePerPatient: 40,
      description:
        'Thực hiện các test tâm lý (MMPI, WAIS, Raven...) để hỗ trợ chẩn đoán.',
      rooms: ['TAM-1502', 'TAM-1504'],
    },
    {
      serviceCode: 'PSY_COUNSEL',
      name: 'Tư vấn tâm lý cá nhân',
      price: 180000.0,
      timePerPatient: 45,
      description: 'Tư vấn cho bệnh nhân gặp stress, lo âu, trầm cảm nhẹ.',
      rooms: ['TAM-1502'],
    },
    {
      serviceCode: 'GROUP_THER',
      name: 'Trị liệu nhóm',
      price: 150000.0,
      timePerPatient: 60,
      description:
        'Trị liệu nhóm hỗ trợ, cải thiện giao tiếp và chia sẻ cảm xúc.',
      rooms: ['TAM-1504'],
    },
    {
      serviceCode: 'OUTPAT_TREAT',
      name: 'Điều trị ngoại trú bằng thuốc',
      price: 220000.0,
      timePerPatient: 20,
      description:
        'Kê đơn và theo dõi điều trị ngoại trú cho bệnh nhân tâm thần.',
      rooms: ['TAM-1503'],
    },
    {
      serviceCode: 'BEHAV_THER',
      name: 'Trị liệu hành vi nhận thức (CBT)',
      price: 300000.0,
      timePerPatient: 60,
      description:
        'Liệu pháp nhận thức – hành vi (CBT) điều trị rối loạn lo âu, trầm cảm.',
      rooms: ['TAM-1504'],
    },
    {
      serviceCode: 'FAM_COUNSEL',
      name: 'Tư vấn gia đình',
      price: 200000.0,
      timePerPatient: 45,
      description: 'Tư vấn cho gia đình bệnh nhân tâm thần để hỗ trợ điều trị.',
      rooms: ['TAM-1502', 'TAM-1503'],
    },
    {
      serviceCode: 'OPD_EXAM',
      name: 'Khám ngoại trú chung',
      price: 120000.0,
      timePerPatient: 20,
      description:
        'Khám tổng quát cho bệnh nhân ngoại trú, chỉ định cận lâm sàng nếu cần.',
      rooms: ['NTC-1601', 'NTC-1602'],
    },
    {
      serviceCode: 'OPD_FOLLOW',
      name: 'Theo dõi điều trị ngoại trú',
      price: 100000.0,
      timePerPatient: 15,
      description:
        'Theo dõi kết quả điều trị, chỉnh thuốc hoặc chăm sóc định kỳ.',
      rooms: ['NTC-1602'],
    },
    {
      serviceCode: 'OPD_MINORPROC',
      name: 'Thủ thuật nhẹ ngoại trú',
      price: 200000.0,
      timePerPatient: 30,
      description: 'Khâu vết thương nhỏ, lấy dị vật nông, chích áp xe nhỏ.',
      rooms: ['NTC-1603'],
    },
    {
      serviceCode: 'OPD_DRESS',
      name: 'Thay băng vết thương nhỏ',
      price: 80000.0,
      timePerPatient: 15,
      description: 'Rửa, thay băng vết thương nhỏ, hướng dẫn chăm sóc tại nhà.',
      rooms: ['NTC-1603'],
    },
    {
      serviceCode: 'OPD_COUNSEL',
      name: 'Tư vấn & sàng lọc sức khỏe',
      price: 90000.0,
      timePerPatient: 15,
      description:
        'Tư vấn sức khỏe tổng quát, sàng lọc bệnh mạn tính (THA, ĐTĐ).',
      rooms: ['NTC-1604'],
    },
    {
      serviceCode: 'OPD_CHECKUP',
      name: 'Khám sức khỏe định kỳ',
      price: 250000.0,
      timePerPatient: 30,
      description:
        'Khám tổng quát, đo huyết áp, BMI, xét nghiệm cơ bản cho bệnh nhân ngoại trú.',
      rooms: ['NTC-1601', 'NTC-1604'],
    },
    {
      serviceCode: 'LAB_BLOOD_BASIC',
      name: 'Xét nghiệm máu cơ bản',
      price: 120000.0,
      timePerPatient: 15,
      description:
        'Kiểm tra công thức máu toàn phần (CBC), hồng cầu, bạch cầu, tiểu cầu.',
      rooms: ['HUY-1405'],
    },
    {
      serviceCode: 'LAB_BLOOD_BIO',
      name: 'Xét nghiệm sinh hóa máu',
      price: 180000.0,
      timePerPatient: 20,
      description:
        'Đo các chỉ số sinh hóa: đường huyết, mỡ máu, chức năng gan, thận.',
      rooms: ['HUY-1405'],
    },
    {
      serviceCode: 'LAB_BLOOD_IMMUNE',
      name: 'Xét nghiệm miễn dịch',
      price: 220000.0,
      timePerPatient: 25,
      description:
        'Xét nghiệm các chỉ số miễn dịch, viêm nhiễm, bệnh lý tự miễn.',
      rooms: ['HUY-1405'],
    },
    {
      serviceCode: 'XRAY_CHEST',
      name: 'Chụp X-quang phổi',
      price: 200000.0,
      timePerPatient: 20,
      description:
        'Chụp X-quang lồng ngực để phát hiện viêm phổi, lao phổi, tổn thương.',
      rooms: ['CHU-1801', 'CHU-1802'],
    },
    {
      serviceCode: 'XRAY_BONE',
      name: 'Chụp X-quang xương khớp',
      price: 220000.0,
      timePerPatient: 20,
      description: 'Chẩn đoán gãy xương, thoái hóa khớp, chấn thương cơ xương.',
      rooms: ['CHU-1801', 'CHU-1802'],
    },
    {
      serviceCode: 'XRAY_CONTRAST',
      name: 'X-quang có cản quang',
      price: 350000.0,
      timePerPatient: 35,
      description:
        'Chụp X-quang với thuốc cản quang để quan sát rõ hệ tiêu hóa, tiết niệu.',
      rooms: ['CHU-1802'],
    },
    {
      serviceCode: 'CT_HEAD',
      name: 'Chụp CT sọ não',
      price: 600000.0,
      timePerPatient: 40,
      description: 'Đánh giá chấn thương sọ não, xuất huyết não, khối u não.',
      rooms: ['CT-1901'],
    },
    {
      serviceCode: 'CT_CHEST',
      name: 'Chụp CT ngực',
      price: 700000.0,
      timePerPatient: 45,
      description:
        'Chẩn đoán ung thư phổi, bệnh phổi kẽ, tổn thương lồng ngực.',
      rooms: ['CT-1901'],
    },
    {
      serviceCode: 'CT_ABDOMEN',
      name: 'Chụp CT ổ bụng',
      price: 750000.0,
      timePerPatient: 50,
      description: 'Phát hiện khối u, viêm nhiễm, bệnh lý gan, mật, tụy.',
      rooms: ['CT-1901'],
    },
    {
      serviceCode: 'MRI_BRAIN',
      name: 'Chụp MRI não',
      price: 1200000.0,
      timePerPatient: 60,
      description:
        'Đánh giá chi tiết não bộ, mạch máu não, u não, bệnh lý thần kinh.',
      rooms: ['CT-1901'],
    },
    {
      serviceCode: 'MRI_SPINE',
      name: 'Chụp MRI cột sống',
      price: 1300000.0,
      timePerPatient: 60,
      description:
        'Phát hiện thoát vị đĩa đệm, thoái hóa cột sống, hẹp ống sống.',
      rooms: ['CT-1901'],
    },
    {
      serviceCode: 'US_ABDOMEN',
      name: 'Siêu âm ổ bụng',
      price: 300000.0,
      timePerPatient: 25,
      description: 'Siêu âm gan, mật, thận, tụy, lách để phát hiện bất thường.',
      rooms: ['CHU-1803'],
    },
    {
      serviceCode: 'US_OBGYN',
      name: 'Siêu âm sản phụ khoa',
      price: 350000.0,
      timePerPatient: 30,
      description:
        'Siêu âm thai kỳ, tử cung, buồng trứng để theo dõi sức khỏe sinh sản.',
      rooms: ['CHU-1803'],
    },
  ];
  const serviceCodeToId: Record<string, string> = {};
  for (const s of servicesJson) {
    const existed = await prisma.service.findUnique({
      where: { serviceCode: s.serviceCode },
    });
    let service = existed;
    if (!service) {
      // Suy luận specialty theo phòng đầu tiên nếu có
      let specialtyId: string | null = null;
      const firstRoomCode = s.rooms?.[0];
      if (firstRoomCode) {
        const roomId = roomCodeToId[firstRoomCode];
        if (roomId) {
          const room = await prisma.clinicRoom.findUnique({
            where: { id: roomId },
          });
          if (room) specialtyId = room.specialtyId;
        }
      }
      service = await prisma.service.create({
        data: {
          serviceCode: s.serviceCode,
          name: s.name,
          price: s.price ?? null,
          durationMinutes: s.timePerPatient ?? 15,
          description: s.description ?? null,
          specialtyId: specialtyId ?? undefined,
        },
      });
    }
    serviceCodeToId[s.serviceCode] = service.id;

    // Liên kết phòng
    if (s.rooms && s.rooms.length > 0) {
      for (const roomCode of s.rooms) {
        const roomId = roomCodeToId[roomCode];
        if (!roomId) continue;
        // Tạo liên kết nếu chưa có
        await prisma.clinicRoomService.upsert({
          where: {
            clinicRoomId_serviceId: {
              clinicRoomId: roomId,
              serviceId: service.id,
            },
          },
          create: {
            clinicRoomId: roomId,
            serviceId: service.id,
          },
          update: {},
        });
      }
    }
  }

  // 3.4b. Seed Service Promotions cho một số dịch vụ tiêu biểu
  const addDays = (base: number): Date => {
    const date = new Date();
    date.setDate(date.getDate() + base);
    return date;
  };

  type ServicePromotionSeed = {
    serviceCode: string;
    name: string;
    description?: string;
    allowLoyaltyDiscount?: boolean;
    maxDiscountPercent?: number;
    maxDiscountAmount?: number;
    startInDays?: number;
    endInDays?: number;
  };

  const servicePromotions: ServicePromotionSeed[] = [
    {
      serviceCode: 'CONSULT_STD',
      name: 'Khai trương phòng khám',
      description: 'Ưu đãi 10% cho khách hàng khám nội tổng quát lần đầu.',
      maxDiscountPercent: 10,
      maxDiscountAmount: 80_000,
      startInDays: -7,
      endInDays: 30,
    },
    {
      serviceCode: 'LASIK_SURG',
      name: 'Giảm giá mùa lễ hội',
      description: 'Giảm tối đa 1.5 triệu cho phẫu thuật khúc xạ LASIK.',
      maxDiscountPercent: 15,
      maxDiscountAmount: 1_500_000,
      startInDays: 0,
      endInDays: 60,
    },
    {
      serviceCode: 'TEETH_WHITEN',
      name: 'Tháng chăm sóc nụ cười',
      description: 'Tẩy trắng răng ưu đãi, không cộng dồn loyalty.',
      allowLoyaltyDiscount: false,
      maxDiscountPercent: 20,
      maxDiscountAmount: 500_000,
      startInDays: -3,
      endInDays: 27,
    },
    {
      serviceCode: 'CHEMO_SESSION',
      name: 'Hỗ trợ bệnh nhân ung bướu',
      description: 'Giảm trực tiếp 500k mỗi chu kỳ truyền hoá chất.',
      maxDiscountPercent: 5,
      maxDiscountAmount: 500_000,
      startInDays: 0,
      endInDays: 120,
    },
    {
      serviceCode: 'GYNE_US',
      name: 'Tầm soát phụ khoa định kỳ',
      description: 'Giảm 15% siêu âm phụ khoa, tối đa 80k.',
      maxDiscountPercent: 15,
      maxDiscountAmount: 80_000,
      startInDays: -14,
      endInDays: 14,
    },
  ];

  for (const promo of servicePromotions) {
    const serviceId = serviceCodeToId[promo.serviceCode];
    if (!serviceId) {
      console.warn(
        `⚠️  ServicePromotion seed: không tìm thấy serviceCode ${promo.serviceCode}, bỏ qua.`,
      );
      continue;
    }

    const startDate =
      promo.startInDays !== undefined ? addDays(promo.startInDays) : null;
    const endDate =
      promo.endInDays !== undefined ? addDays(promo.endInDays) : null;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.servicePromotion.upsert({
      where: { serviceId },
      update: {
        name: promo.name,
        description: promo.description ?? null,
        allowLoyaltyDiscount:
          promo.allowLoyaltyDiscount === undefined
            ? true
            : promo.allowLoyaltyDiscount,
        maxDiscountPercent: promo.maxDiscountPercent ?? null,
        maxDiscountAmount: promo.maxDiscountAmount ?? null,
        startDate,
        endDate,
        isActive: true,
      },
      create: {
        serviceId,
        name: promo.name,
        description: promo.description ?? null,
        allowLoyaltyDiscount:
          promo.allowLoyaltyDiscount === undefined
            ? true
            : promo.allowLoyaltyDiscount,
        maxDiscountPercent: promo.maxDiscountPercent ?? null,
        maxDiscountAmount: promo.maxDiscountAmount ?? null,
        startDate,
        endDate,
        isActive: true,
      },
    });
  }

  // 3.4. Seed Counters
  type CounterJson = {
    counterCode: string;
    counterName: string;
    location?: string;
    isActive?: boolean;
    maxQueue?: number;
  };
  const countersJson: CounterJson[] = [
    {
      counterCode: 'CTR001',
      counterName: 'Quầy Tiếp Nhận 1',
      location: 'Tầng 1 - Khu A',
      isActive: true,
      maxQueue: 15,
    },
    {
      counterCode: 'CTR002',
      counterName: 'Quầy Tiếp Nhận 2',
      location: 'Tầng 1 - Khu B',
      isActive: true,
      maxQueue: 15,
    },
  ];
  const counterCodeToId: Record<string, string> = {};
  for (const c of countersJson) {
    const existed = await prisma.counter.findUnique({
      where: { counterCode: c.counterCode },
    });
    const counter = existed
      ? existed
      : await prisma.counter.create({
          data: {
            counterCode: c.counterCode,
            counterName: c.counterName,
            location: c.location ?? null,
            isActive: c.isActive ?? true,
            maxQueue: c.maxQueue ?? 10,
          },
        });
    counterCodeToId[c.counterCode] = counter.id;
  }

  // 3.5. Tạo lịch sử phân công CounterAssignments (không dùng id mẫu trong JSON)
  // Liên kết lễ tân hiện có với các quầy theo trình tự
  const receptionists = await prisma.receptionist.findMany({
    select: { id: true },
  });
  if (receptionists.length > 0) {
    const counters = await prisma.counter.findMany({ select: { id: true } });
    // Gán mỗi receptionist vào một counter theo vòng tròn
    let idx = 0;
    for (const r of receptionists) {
      const counter = counters[idx % counters.length];
      idx++;
      // upsert assignment ACTIVE hiện tại nếu chưa có
      await prisma.counterAssignment.create({
        data: {
          counterId: counter.id,
          receptionistId: r.id,
          status: 'ACTIVE',
          notes: 'Phân công tự động từ seed',
        },
      });
    }
  }

  // 3. TẠM THỜI BỎ cách phát sinh phòng khám và dịch vụ theo for để tránh nhân bản service theo từng phòng
  // Vui lòng sử dụng file `prisma/seed_clinic.ts` để seed dữ liệu phòng, bác sĩ, dịch vụ và mapping n-n.
  // const targetSpecialties: never[] = [];

  console.log(
    '🎉 Basic seed completed! Please run the following commands to complete the setup:',
  );

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
    const defaultSpecialty =
      (await prisma.specialty.findFirst()) ||
      (await prisma.specialty.create({
        data: { specialtyCode: 'GEN', name: 'General' },
      }));
    await prisma.doctor.create({
      data: {
        id: doctorAuth.id, // Sử dụng cùng id với auth
        doctorCode: codeGen.generateDoctorCode(
          doctorAuth.name ?? 'Doctor',
          'Nội tổng quát',
        ),
        authId: doctorAuth.id,
        yearsExperience: 10,
        rating: 4.8,
        ratingCount: 25,
        workHistory: 'Bệnh viện Trà Ôn',
        description:
          'Chuyên gia nội tổng quát với hơn 10 năm kinh nghiệm khám và điều trị bệnh lý nội khoa.',
        specialtyId: defaultSpecialty.id,
        subSpecialties: ['Tim mạch', 'Tiêu hóa'],
        position: 'Bác sĩ nội tổng quát',
        isActive: true,
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
  const sampleProfiles = [
    {
      profileCode: 'PP_01',
      name: 'Nguyễn Thanh Cảnh',
      dateOfBirth: new Date('2003-01-01'),
      gender: 'male',
      address: 'Quận 1, TP HCM',
      occupation: 'Nhân viên văn phòng',
      emergencyContact: {
        name: 'Ngọc Anh',
        phone: '0901234567',
        relationship: 'vợ',
      },
      healthInsurance: 'BHYT-123456789',
      relationship: 'Chính chủ',
    },
    {
      profileCode: 'PP_02',
      name: 'Ngọc Anh',
      dateOfBirth: new Date('2003-01-01'),
      gender: 'female',
      address: 'Quận Bình Thạnh, TP HCM',
      occupation: 'Giáo viên',
      emergencyContact: {
        name: 'Nguyễn Thanh Cảnh',
        phone: '0900000001',
        relationship: 'chồng',
      },
      healthInsurance: null,
      relationship: 'Chính chủ',
    },
  ];

  for (const p of sampleProfiles) {
    const existedProfile = await prisma.patientProfile.findFirst({
      where: { profileCode: p.profileCode, patientId: patientAuth.id },
    });
    if (!existedProfile) {
      await prisma.patientProfile.create({
        data: {
          profileCode: p.profileCode,
          patientId: patientAuth.id,
          name: p.name,
          dateOfBirth: p.dateOfBirth,
          gender: p.gender,
          address: p.address,
          occupation: p.occupation,
          emergencyContact: p.emergencyContact,
          healthInsurance: p.healthInsurance,
          relationship: p.relationship,
        },
      });
    }
  }

  // Thêm một số bệnh nhân khác, mỗi người có 1 profile giống thông tin tài khoản
  const extraPatients = [
    {
      name: 'Trần Văn Bình',
      email: 'patient2@gmail.com',
      phone: '0900000012',
      dateOfBirth: new Date('1992-04-12'),
      gender: 'male',
      address: 'Quận 3, TP HCM',
      citizenId: '2222223333',
    },
    {
      name: 'Lê Thị Hoa',
      email: 'patient3@gmail.com',
      phone: '0900000013',
      dateOfBirth: new Date('1996-09-25'),
      gender: 'female',
      address: 'Quận 7, TP HCM',
      citizenId: '2222224444',
    },
    {
      name: 'Phạm Minh Tuấn',
      email: 'patient4@gmail.com',
      phone: '0900000014',
      dateOfBirth: new Date('1988-01-30'),
      gender: 'male',
      address: 'TP Thủ Đức, TP HCM',
      citizenId: '2222225555',
    },
    {
      name: 'Võ Ngọc Lan',
      email: 'patient5@gmail.com',
      phone: '0900000015',
      dateOfBirth: new Date('1999-12-05'),
      gender: 'female',
      address: 'Quận Bình Thạnh, TP HCM',
      citizenId: '2222226666',
    },
  ];

  for (const ep of extraPatients) {
    let epAuth = await prisma.auth.findUnique({ where: { email: ep.email } });
    if (!epAuth) {
      epAuth = await prisma.auth.create({
        data: {
          name: ep.name,
          dateOfBirth: ep.dateOfBirth,
          email: ep.email,
          phone: ep.phone,
          password: password,
          gender: ep.gender,
          avatar: null,
          address: ep.address,
          citizenId: ep.citizenId,
          role: 'PATIENT',
        },
      });
    }

    const epPatient = await prisma.patient.findUnique({
      where: { authId: epAuth.id },
    });
    if (!epPatient) {
      await prisma.patient.create({
        data: {
          id: epAuth.id,
          patientCode: codeGen.generatePatientCode(
            epAuth.name ?? 'Patient',
            epAuth.dateOfBirth ?? new Date('1990-01-01'),
            epAuth.gender ?? 'other',
          ),
          authId: epAuth.id,
          loyaltyPoints: 0,
        },
      });
    }

    const existedEpProfile = await prisma.patientProfile.findFirst({
      where: { patientId: epAuth.id, name: ep.name },
    });
    if (!existedEpProfile) {
      await prisma.patientProfile.create({
        data: {
          profileCode: codeGen.generateProfileCode(
            ep.name,
            ep.dateOfBirth,
            ep.gender,
          ),
          patientId: epAuth.id,
          name: ep.name,
          dateOfBirth: ep.dateOfBirth,
          gender: ep.gender,
          address: ep.address,
          occupation: null,
          emergencyContact: {
            name: ep.name,
            phone: ep.phone,
            relationship: 'Chính chủ',
          },
          healthInsurance: null,
          relationship: 'Chính chủ',
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
        dateOfBirth: new Date('2003-01-01'),
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
    const receptionistCode = codeGen.generateReceptionistCode(
      receptionistAuth.name ?? 'Receptionist',
    );
    await prisma.receptionist.create({
      data: {
        id: receptionistAuth.id, // Sử dụng cùng id với auth
        authId: receptionistAuth.id,
        receptionistCode,
      },
    });
  }

  // Thêm 3 bác sĩ ở các chuyên khoa khác nhau
  const doctorSamples = [
    {
      email: 'doctor.cardiology@gmail.com',
      name: 'Nguyễn Minh Tâm',
      phone: '0901000001',
      gender: 'male',
      address: 'TP HCM',
      citizenId: '7777777777',
      specialtyName: 'Tim mạch',
      yearsExperience: 8,
      rating: 4.6,
      ratingCount: 12,
      workHistory: 'BV Chợ Rẫy',
      description:
        'Bác sĩ tim mạch, chuyên can thiệp mạch vành và quản lý suy tim.',
      subSpecialties: ['Can thiệp mạch vành'],
      position: 'Bác sĩ chuyên khoa Tim mạch',
    },
    {
      email: 'doctor.dermatology@gmail.com',
      name: 'Trần Thu Hà',
      phone: '0901000002',
      gender: 'female',
      address: 'TP HCM',
      citizenId: '8888888888',
      specialtyName: 'Da liễu',
      yearsExperience: 6,
      rating: 4.7,
      ratingCount: 18,
      workHistory: 'BV Da Liễu TP HCM',
      description:
        'Bác sĩ da liễu, chuyên điều trị bệnh lý da mạn tính và thẩm mỹ.',
      subSpecialties: ['Thẩm mỹ da', 'Viêm da cơ địa'],
      position: 'Bác sĩ chuyên khoa Da liễu',
    },
    {
      email: 'doctor.dentistry@gmail.com',
      name: 'Phạm Quốc Huy',
      phone: '0901000003',
      gender: 'male',
      address: 'TP HCM',
      citizenId: '9999999999',
      specialtyName: 'Răng hàm mặt',
      yearsExperience: 9,
      rating: 4.5,
      ratingCount: 20,
      workHistory: 'Nha khoa Trung Tâm',
      description: 'Bác sĩ RHM, chuyên phục hình răng và implant.',
      subSpecialties: ['Phục hình răng', 'Implant'],
      position: 'Bác sĩ Răng Hàm Mặt',
    },
    {
      email: 'doctor.ophthal@gmail.com',
      name: 'Ngô Quốc Khánh',
      phone: '0901000004',
      gender: 'male',
      address: 'TP HCM',
      citizenId: '1111222233',
      specialtyName: 'Mắt',
      yearsExperience: 7,
      rating: 4.6,
      ratingCount: 14,
      workHistory: 'BV Mắt TP HCM',
      description: 'Bác sĩ mắt, chuyên khúc xạ và glôcôm.',
      subSpecialties: ['Khúc xạ', 'Glôcôm'],
      position: 'Bác sĩ chuyên khoa Mắt',
    },
    {
      email: 'doctor.surgery@gmail.com',
      name: 'Đỗ Thành Danh',
      phone: '0901000005',
      gender: 'male',
      address: 'TP HCM',
      citizenId: '1111222244',
      specialtyName: 'Ngoại khoa',
      yearsExperience: 12,
      rating: 4.7,
      ratingCount: 30,
      workHistory: 'BV Bình Dân',
      description: 'Phẫu thuật viên tổng quát và tiêu hoá.',
      subSpecialties: ['Ngoại tổng quát', 'Ngoại tiêu hoá'],
      position: 'Bác sĩ Ngoại khoa',
    },
    {
      email: 'doctor.infect@gmail.com',
      name: 'Trịnh Thu Ngân',
      phone: '0901000006',
      gender: 'female',
      address: 'TP HCM',
      citizenId: '1111222255',
      specialtyName: 'Truyền nhiễm',
      yearsExperience: 8,
      rating: 4.5,
      ratingCount: 16,
      workHistory: 'BV Bệnh Nhiệt Đới',
      description: 'Bác sĩ truyền nhiễm, điều trị HIV và viêm gan virus.',
      subSpecialties: ['HIV/AIDS', 'Viêm gan virus'],
      position: 'Bác sĩ Truyền nhiễm',
    },
    {
      email: 'doctor.pediatrics@gmail.com',
      name: 'Phan Nhật Minh',
      phone: '0901000007',
      gender: 'male',
      address: 'TP HCM',
      citizenId: '1111222266',
      specialtyName: 'Nhi khoa',
      yearsExperience: 6,
      rating: 4.6,
      ratingCount: 11,
      workHistory: 'Nhi Đồng 2',
      description: 'Bác sĩ nhi tổng quát, hô hấp nhi.',
      subSpecialties: ['Hô hấp nhi'],
      position: 'Bác sĩ Nhi khoa',
    },
    {
      email: 'doctor.gyn@gmail.com',
      name: 'Nguyễn Bích Phượng',
      phone: '0901000008',
      gender: 'female',
      address: 'TP HCM',
      citizenId: '1111222277',
      specialtyName: 'Phụ khoa',
      yearsExperience: 10,
      rating: 4.8,
      ratingCount: 22,
      workHistory: 'BV Hùng Vương',
      description:
        'Khám và điều trị bệnh lý phụ khoa, tầm soát ung thư cổ tử cung.',
      subSpecialties: ['Nội tiết sinh sản'],
      position: 'Bác sĩ Phụ khoa',
    },
    {
      email: 'doctor.ent@gmail.com',
      name: 'Vũ Hải Long',
      phone: '0901000009',
      gender: 'male',
      address: 'TP HCM',
      citizenId: '1111222288',
      specialtyName: 'Tai mũi họng',
      yearsExperience: 9,
      rating: 4.6,
      ratingCount: 19,
      workHistory: 'BV Tai Mũi Họng',
      description: 'Chuyên nội soi TMH và phẫu thuật amidan.',
      subSpecialties: ['Nội soi TMH'],
      position: 'Bác sĩ Tai Mũi Họng',
    },
    {
      email: 'doctor.rehab@gmail.com',
      name: 'Lâm Thanh Tú',
      phone: '0901000010',
      gender: 'female',
      address: 'TP HCM',
      citizenId: '1111222299',
      specialtyName: 'Phục hồi chức năng',
      yearsExperience: 7,
      rating: 4.5,
      ratingCount: 13,
      workHistory: 'Trung tâm PHCN',
      description: 'Phục hồi sau đột quỵ và chỉnh hình.',
      subSpecialties: ['Vật lý trị liệu', 'Hoạt động trị liệu'],
      position: 'Bác sĩ PHCN',
    },
    {
      email: 'doctor.hematology@gmail.com',
      name: 'Bùi Anh Thư',
      phone: '0901000011',
      gender: 'female',
      address: 'TP HCM',
      citizenId: '1111222300',
      specialtyName: 'Huyết học/truyền máu',
      yearsExperience: 11,
      rating: 4.7,
      ratingCount: 21,
      workHistory: 'BV Huyết học – Truyền máu',
      description: 'Thiếu máu, rối loạn đông máu, truyền máu.',
      subSpecialties: ['Huyết học lâm sàng'],
      position: 'Bác sĩ Huyết học',
    },
    {
      email: 'doctor.psychiatry@gmail.com',
      name: 'Trương Hồng Ân',
      phone: '0901000012',
      gender: 'female',
      address: 'TP HCM',
      citizenId: '1111222311',
      specialtyName: 'Tâm thần',
      yearsExperience: 8,
      rating: 4.6,
      ratingCount: 15,
      workHistory: 'BV Tâm thần TP HCM',
      description: 'Trầm cảm, lo âu, CBT.',
      subSpecialties: ['Tâm lý trị liệu'],
      position: 'Bác sĩ Tâm thần',
    },
    {
      email: 'doctor.ortho@gmail.com',
      name: 'Mai Đức Trí',
      phone: '0901000013',
      gender: 'male',
      address: 'TP HCM',
      citizenId: '1111222322',
      specialtyName: 'Chỉnh hình xương khớp',
      yearsExperience: 10,
      rating: 4.7,
      ratingCount: 24,
      workHistory: 'BV Chấn thương Chỉnh hình',
      description: 'Thay khớp và nội soi khớp.',
      subSpecialties: ['Nội soi khớp', 'Thay khớp'],
      position: 'Bác sĩ Chỉnh hình',
    },
    {
      email: 'doctor.digestive@gmail.com',
      name: 'Hồ Anh Khoa',
      phone: '0901000014',
      gender: 'male',
      address: 'TP HCM',
      citizenId: '1111222333',
      specialtyName: 'Tiêu hóa',
      yearsExperience: 9,
      rating: 4.6,
      ratingCount: 17,
      workHistory: 'BV Đại học Y Dược',
      description: 'Tiêu hoá – gan mật, nội soi tiêu hoá.',
      subSpecialties: ['Nội soi tiêu hoá'],
      position: 'Bác sĩ Tiêu hoá',
    },
    {
      email: 'doctor.radiology@gmail.com',
      name: 'Trần Quốc Hiển',
      phone: '0901000015',
      gender: 'male',
      address: 'TP HCM',
      citizenId: '1111222344',
      specialtyName: 'Chuẩn đoán hình ảnh',
      yearsExperience: 8,
      rating: 4.5,
      ratingCount: 12,
      workHistory: 'Khoa CĐHA - BV Đa khoa',
      description: 'Chẩn đoán hình ảnh, siêu âm tim – mạch.',
      subSpecialties: ['Siêu âm', 'CT/MRI'],
      position: 'Bác sĩ CĐHA',
    },
  ];

  for (const ds of doctorSamples) {
    let auth = await prisma.auth.findUnique({
      where: { email: ds.email },
    });
    if (!auth) {
      auth = await prisma.auth.create({
        data: {
          name: ds.name,
          dateOfBirth: new Date('1990-01-01'),
          email: ds.email,
          phone: ds.phone,
          password: password,
          gender: ds.gender,
          avatar: null,
          address: ds.address,
          citizenId: ds.citizenId,
          role: 'DOCTOR',
        },
      });
    }

    const existed = await prisma.doctor.findUnique({
      where: { authId: auth.id },
    });
    if (!existed) {
      const specialty =
        specialtyMap[ds.specialtyName] ||
        (await prisma.specialty.findFirst({
          where: { name: ds.specialtyName },
        })) ||
        (await prisma.specialty.create({
          data: {
            name: ds.specialtyName,
            specialtyCode: ds.specialtyName
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .replace(/\s+/g, '')
              .toUpperCase(),
          },
        }));

      await prisma.doctor.create({
        data: {
          id: auth.id,
          doctorCode: codeGen.generateDoctorCode(ds.name, ds.specialtyName),
          authId: auth.id,
          yearsExperience: ds.yearsExperience,
          rating: ds.rating,
          ratingCount: ds.ratingCount,
          workHistory: ds.workHistory,
          description: ds.description,
          specialtyId: specialty.id,
          subSpecialties: ds.subSpecialties,
          position: ds.position,
          isActive: true,
        },
      });
    }
  }

  // 3.x Tạo 3 lịch làm việc mẫu cho mỗi bác sĩ
  const doctors = await prisma.doctor.findMany({
    select: { id: true, specialtyId: true },
  });

  // Helper tạo thời gian theo giờ địa phương
  function atTime(base: Date, hours: number, minutes: number): Date {
    const d = new Date(base);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  for (const d of doctors) {
    // Tìm 1 phòng và 1 booth thuộc cùng chuyên khoa (nếu có)
    const room = await prisma.clinicRoom.findFirst({
      where: { specialtyId: d.specialtyId },
      orderBy: { roomCode: 'asc' },
    });

    let boothId: string | undefined = undefined;
    if (room) {
      const booth = await prisma.booth.findFirst({
        where: { roomId: room.id },
        orderBy: { boothCode: 'asc' },
      });
      if (booth) boothId = booth.id;
    }

    // Nếu không có booth phù hợp, bỏ qua không tạo work session
    if (!boothId) {
      continue;
    }

    const slots = [
      { start: atTime(today, 8, 0), end: atTime(today, 12, 0) },
      { start: atTime(today, 13, 30), end: atTime(today, 17, 30) },
      { start: atTime(tomorrow, 8, 0), end: atTime(tomorrow, 12, 0) },
    ];

    for (const s of slots) {
      const existed = await prisma.workSession.findFirst({
        where: { doctorId: d.id, startTime: s.start },
      });
      if (existed) continue;

      const createdWorkSession = await prisma.workSession.create({
        data: {
          boothId: boothId,
          doctorId: d.id,
          startTime: s.start,
          endTime: s.end,
          nextAvailableAt: null,
          status: 'APPROVED',
        },
      });

      // Gán các service trùng chuyên khoa cho work session vừa tạo
      const specialtyServices = await prisma.service.findMany({
        where: { specialtyId: d.specialtyId },
        orderBy: { name: 'asc' },
        take: 3,
      });

      for (const svc of specialtyServices) {
        await prisma.workSessionService.upsert({
          where: {
            workSessionId_serviceId: {
              workSessionId: createdWorkSession.id,
              serviceId: svc.id,
            },
          },
          create: {
            workSessionId: createdWorkSession.id,
            serviceId: svc.id,
          },
          update: {},
        });
      }
    }
  }

  // Cashier
  let cashierAuth = await prisma.auth.findUnique({
    where: { email: 'cashier@gmail.com' },
  });
  if (!cashierAuth) {
    cashierAuth = await prisma.auth.create({
      data: {
        name: 'Hồ Thị Như Tâm',
        dateOfBirth: new Date('2003-01-01'),
        email: 'cashier@gmail.com',
        phone: '0900000003',
        password: password,
        gender: 'female',
        avatar: null,
        address: 'TP HCM',
        citizenId: '5555555555',
        role: 'CASHIER',
      },
    });
  }

  const existedCashier = await prisma.cashier.findUnique({
    where: { authId: cashierAuth.id },
  });
  if (!existedCashier) {
    const cashierCode = codeGen.generateCashierCode(
      cashierAuth.name ?? 'Cashier',
    );
    await prisma.cashier.create({
      data: {
        id: cashierAuth.id,
        authId: cashierAuth.id,
        cashierCode,
      },
    });
  }

  // Technician
  let technicianAuth = await prisma.auth.findUnique({
    where: { email: 'technician@gmail.com' },
  });
  if (!technicianAuth) {
    technicianAuth = await prisma.auth.create({
      data: {
        name: 'Nguyễn Xuân Nam',
        dateOfBirth: new Date('2003-01-01'),
        email: 'technician@gmail.com',
        phone: '0900000004',
        password: password,
        gender: 'male',
        avatar: null,
        address: 'TP HCM',
        citizenId: '6666666666',
        role: 'TECHNICIAN',
      },
    });
  }

  const existedTechnician = await prisma.technician.findUnique({
    where: { authId: technicianAuth.id },
  });
  if (!existedTechnician) {
    const technicianCode = codeGen.generateTechnicianCode(
      technicianAuth.name ?? 'Technician',
    );
    await prisma.technician.create({
      data: {
        id: technicianAuth.id,
        authId: technicianAuth.id,
        technicianCode,
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
