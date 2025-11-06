/* eslint-disable */
import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TranslationService } from './translation.service';
import axios from 'axios';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { JwtUserPayload } from './dto/jwt-user-payload.dto';
import { Role } from '../rbac/roles.enum';
import { MedicalRecordStatus } from '@prisma/client';
import { CodeGeneratorService } from '../user-management/patient-profile/code-generator.service';

@Injectable()
export class MedicalRecordService {
  private codeGenerator = new CodeGeneratorService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly translationService: TranslationService,
  ) {}

  async create(dto: CreateMedicalRecordDto, user: JwtUserPayload) {
    if (
      ![Role.DOCTOR, Role.ADMIN].includes(user.role as Role)
    ) {
      throw new ForbiddenException('Bạn không có quyền tạo hồ sơ bệnh án');
    }

    // Only support patientProfileId now
    if (!dto.patientProfileId) {
      throw new BadRequestException('Missing required field: patientProfileId');
    }

    let doctorId: string | undefined;
    if (user.role === Role.DOCTOR) {
      const providedDoctorId = (dto as any)['doctorId'] as string | undefined;
      if (providedDoctorId) {
        // Nếu có providedDoctorId, có thể là authId hoặc doctorId
        // Thử tìm theo authId trước, nếu không có thì tìm theo doctorId
        let doctor = await this.prisma.doctor.findUnique({
          where: { authId: providedDoctorId },
          select: { id: true }
        });

        if (!doctor) {
          // Thử tìm theo doctorId
          doctor = await this.prisma.doctor.findUnique({
            where: { id: providedDoctorId },
            select: { id: true }
          });
        }

        if (!doctor) {
          throw new NotFoundException('Không tìm thấy bác sĩ');
        }
        doctorId = doctor.id;
      } else {
        const doctor = await this.prisma.doctor.findUnique({
          where: { authId: user.id },
          select: { id: true }
        });
        doctorId = doctor?.id;
        if (!doctorId) {
          throw new NotFoundException('Không tìm thấy bác sĩ cho user này');
        }
      }
    } else if (
      user.role === Role.ADMIN
    ) {
      doctorId = (dto as any)['doctorId'];
      if (!doctorId) {
        throw new ForbiddenException('Admin phải chọn bác sĩ tạo hồ sơ (doctorId)');
      }

      // Tương tự như trên, có thể là authId hoặc doctorId
      let doctor = await this.prisma.doctor.findUnique({
        where: { authId: doctorId },
        select: { id: true }
      });

      if (!doctor) {
        // Thử tìm theo doctorId
        doctor = await this.prisma.doctor.findUnique({
          where: { id: doctorId },
          select: { id: true }
        });
      }

      if (!doctor) {
        throw new NotFoundException('Không tìm thấy bác sĩ');
      }
      doctorId = doctor.id;
    }

    // Validate patient profile exists
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: dto.patientProfileId }
    });
    if (!patientProfile) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }

    // Get doctor and patient names for code generation
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { auth: true },
    });

    const medicalRecordCode = this.codeGenerator.generateMedicalRecordCode(
      doctor?.auth?.name || 'Unknown',
      patientProfile?.name || 'Unknown',
    );

    const data: any = {
      patientProfileId: dto.patientProfileId,
      templateId: dto.templateId,
      content: dto.content,
      medicalRecordCode,
      status: MedicalRecordStatus.DRAFT,
      doctorId,
    };
    const created = await this.prisma.medicalRecord.create({ data });
    
    // Lưu lịch sử tạo mới
    await this.prisma.medicalRecordHistory.create({
      data: {
        medicalRecordId: created.id,
        changedBy: user.id,
        changes: { action: 'CREATE', data: created },
      },
    });
    
    return created;
  }

  /**
   * Gọi hệ thống gợi ý bệnh dựa trên mã bệnh án (medicalRecordCode)
   * - Tính tuổi từ ngày sinh, chuẩn hóa giới tính (M/F/O)
   * - notes: chuỗi hóa nội dung bệnh án
   * - Gọi {{RECOMMENDER_BASE_URL}}/predict
   * - Sắp xếp theo probability giảm dần, dịch disease_name EN->VI
   */
  async predictDiseasesByMedicalRecordCode(
    code: string,
    user: JwtUserPayload,
  ): Promise<{ predictions: Array<{ icd_code?: string; probability: number; disease_name_en: string; disease_name_vi: string }>; patient_info: { age: number; gender: 'M' | 'F' | 'O'; notes: string } }> {
    // Tìm hồ sơ theo mã
    const record = await this.prisma.medicalRecord.findFirst({
      where: { medicalRecordCode: code },
      include: {
        patientProfile: true,
      },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');

    // Quyền truy cập: bệnh nhân chỉ xem hồ sơ của mình, bác sĩ chỉ xem hồ sơ do mình tạo
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      if (record.patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }
    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      if (record.doctorId !== user.doctor.id) {
        throw new ForbiddenException('Bạn chỉ xem được hồ sơ do mình tạo');
      }
    }

    // Tính tuổi
    const dob = record.patientProfile.dateOfBirth as unknown as Date;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    if (age < 0) age = 0;

    // Giới tính -> M/F/O
    const rawGender = (record.patientProfile.gender || '').toString().toLowerCase();
    let gender: 'M' | 'F' | 'O' = 'O';
    if (['male', 'nam', 'm'].includes(rawGender)) gender = 'M';
    else if (['female', 'nữ', 'nu', 'f'].includes(rawGender)) gender = 'F';

    // Notes từ content (rút gọn thành chuỗi)
    const notes = JSON.stringify(record.content || {});

    const baseUrl = process.env.RECOMMENDER_BASE_URL;
    if (!baseUrl) {
      throw new BadRequestException('Thiếu cấu hình RECOMMENDER_BASE_URL');
    }

    // Gọi API dự đoán
    const payload = { age, gender, notes };
    const { data } = await axios.post(`${baseUrl}/predict`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    });

    const predictions = Array.isArray(data?.predictions) ? data.predictions as Array<{ icd_code?: string; probability: number; disease_name: string }> : [];
    // Sắp xếp theo probability giảm dần
    predictions.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));

    // Dịch danh sách disease_name EN -> VI theo từng dòng để tối ưu gọi dịch
    const englishNames = predictions.map((p) => p.disease_name ?? '');
    const joined = englishNames.join('\n');
    const viJoined = await this.translationService.translateEnToVi(joined);
    const viNames = viJoined.split('\n');

    const mapped = predictions.map((p, idx) => ({
      icd_code: p.icd_code,
      probability: p.probability,
      disease_name_en: p.disease_name,
      disease_name_vi: viNames[idx] ?? p.disease_name,
    }));

    return {
      predictions: mapped,
      patient_info: { age, gender, notes },
    };
  }

  /**
   * Gọi hệ thống gợi ý bệnh dựa trên id bệnh án
   * - Tính tuổi từ ngày sinh, chuẩn hóa giới tính (M/F/O)
   * - notes: chuỗi hóa nội dung bệnh án
   * - Gọi {{RECOMMENDER_BASE_URL}}/predict
   * - Sắp xếp theo probability giảm dần, dịch disease_name EN->VI
   */
  async predictDiseasesByMedicalRecordId(
    id: string,
    user: JwtUserPayload,
  ): Promise<{ predictions: Array<{ icd_code?: string; probability: number; disease_name_en: string; disease_name_vi: string }>; patient_info: { age: number; gender: 'M' | 'F' | 'O'; notes: string } }> {
    // Tìm hồ sơ theo id
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        patientProfile: true,
      },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');

    // Quyền truy cập: bệnh nhân chỉ xem hồ sơ của mình, bác sĩ chỉ xem hồ sơ do mình tạo
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      if (record.patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }
    // if (user.role === Role.DOCTOR) {
    //   if (!user.doctor?.id) throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    //   if (record.doctorId !== user.doctor.id) {
    //     throw new ForbiddenException('Bạn chỉ xem được hồ sơ do mình tạo');
    //   }
    // }

    // Tính tuổi
    const dob = record.patientProfile.dateOfBirth as unknown as Date;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    if (age < 0) age = 0;

    // Giới tính -> M/F/O
    const rawGender = (record.patientProfile.gender || '').toString().toLowerCase();
    let gender: 'M' | 'F' | 'O' = 'O';
    if (['male', 'nam', 'm'].includes(rawGender)) gender = 'M';
    else if (['female', 'nữ', 'nu', 'f'].includes(rawGender)) gender = 'F';

    // Notes từ content (rút gọn thành chuỗi) và dịch VI -> EN cho recommender
    const notesVi = JSON.stringify(record.content || {});
    const notes = await this.translationService.translateViToEn(notesVi);

    const baseUrl = process.env.RECOMMENDER_BASE_URL;
    if (!baseUrl) {
      throw new BadRequestException('Thiếu cấu hình RECOMMENDER_BASE_URL');
    }

    // Gọi API dự đoán
    const payload = { age, gender, notes };
    const { data } = await axios.post(`${baseUrl}/predict`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    });

    const predictions = Array.isArray(data?.predictions) ? data.predictions as Array<{ icd_code?: string; probability: number; disease_name: string }> : [];
    // Sắp xếp theo probability giảm dần
    predictions.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));

    // Dịch danh sách disease_name EN -> VI theo từng dòng để tối ưu gọi dịch
    const englishNames = predictions.map((p) => p.disease_name ?? '');
    const joined = englishNames.join('\n');
    const viJoined = await this.translationService.translateEnToVi(joined);
    const viNames = viJoined.split('\n');

    const mapped = predictions.map((p, idx) => ({
      icd_code: p.icd_code,
      probability: p.probability,
      disease_name_en: p.disease_name,
      disease_name_vi: viNames[idx] ?? p.disease_name,
    }));

    return {
      predictions: mapped,
      patient_info: { age, gender, notes },
    };
  }
  async findAll(
    user: JwtUserPayload,
    page: string = '1',
    limit: string = '10',
    patientProfileName?: string,
  ) {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || '10', 10) || 10, 1),
      100,
    );
    const skip = (pageNum - 1) * limitNum;
    const include = {
      histories: {
        select: {
          changedBy: true,
          changedAt: true,
        },
      },
      patientProfile: true,
      doctor: {
        include: {
          auth: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              avatar: true,
              gender: true,
            },
          },
        },
      },
    };

    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      
      // Get all patient profiles for this patient
      const patientProfiles = await this.prisma.patientProfile.findMany({
        where: { patientId: user.patient.id },
        select: { id: true },
      });
      
      const patientProfileIds = patientProfiles.map(profile => profile.id);
      const patientWhere: any = {
        patientProfileId: { in: patientProfileIds },
        ...(patientProfileName
          ? { patientProfile: { name: { contains: patientProfileName, mode: 'insensitive' } } }
          : {}),
      };
      const [total, data] = await this.prisma.$transaction([
        this.prisma.medicalRecord.count({ where: patientWhere }),
        this.prisma.medicalRecord.findMany({
          where: patientWhere,
          include,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        })
      ]);
      return { data, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
    }

    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }
      const doctorWhere: any = {
        doctorId: user.doctor.id,
        ...(patientProfileName
          ? { patientProfile: { name: { contains: patientProfileName, mode: 'insensitive' } } }
          : {}),
      };
      const [total, data] = await this.prisma.$transaction([
        this.prisma.medicalRecord.count({ where: doctorWhere }),
        this.prisma.medicalRecord.findMany({
          where: doctorWhere,
          include,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        })
      ]);
      return { data, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
    }

    // Cho admin - có thể xem tất cả
    const adminWhere: any = {
      ...(patientProfileName
        ? { patientProfile: { name: { contains: patientProfileName, mode: 'insensitive' } } }
        : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.medicalRecord.count({ where: adminWhere }),
      this.prisma.medicalRecord.findMany({
        where: adminWhere,
        include,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      })
    ]);
    return { data, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }

  async findByPatientProfile(patientProfileId: string, user: JwtUserPayload, page: string = '1', limit: string = '10') {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || '10', 10) || 10, 1),
      100,
    );
    const skip = (pageNum - 1) * limitNum;
    const include = {
      histories: {
        select: {
          changedBy: true,
          changedAt: true,
        },
      },
      patientProfile: true,
      doctor: {
        include: {
          auth: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              avatar: true,
              gender: true,
            },
          },
        },
      },
    };

    // Validate patient profile exists
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      include: { patient: true },
    });
    
    if (!patientProfile) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }

    // Check permissions based on user role
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      
      // Patient can only view their own profiles
      if (patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }
      
      // Doctor can view records they created for this patient profile
      const [total, data] = await this.prisma.$transaction([
        this.prisma.medicalRecord.count({ where: { patientProfileId, doctorId: user.doctor.id } }),
        this.prisma.medicalRecord.findMany({
          where: { patientProfileId, doctorId: user.doctor.id },
          include,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        })
      ]);
      return { data, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
    }

    // Admin can view all records for any patient profile
    const [total, data] = await this.prisma.$transaction([
      this.prisma.medicalRecord.count({ where: { patientProfileId } }),
      this.prisma.medicalRecord.findMany({
        where: { patientProfileId },
        include,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      })
    ]);
    return { data, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }


  async findOne(id: string, user: JwtUserPayload) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        histories: {
          select: {
            changedBy: true,
            changedAt: true,
          },
        },
        patientProfile: true,
        doctor: {
          include: {
            auth: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatar: true,
                gender: true,
              },
            },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      
      // Check if the patient profile belongs to this patient
      const patientProfile = await this.prisma.patientProfile.findUnique({
        where: { id: record.patientProfileId },
        select: { patientId: true },
      });
      
      if (!patientProfile || patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }
      
      if (record.doctorId !== user.doctor.id) {
        throw new ForbiddenException('Bạn chỉ xem được hồ sơ do mình tạo');
      }
    }

    return record;
  }


  async findByCode(code: string, user: JwtUserPayload) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { medicalRecordCode: code },
      include: {
        histories: {
          select: {
            changedBy: true,
            changedAt: true,
          },
        },
        patientProfile: true,
        doctor: {
          include: {
            auth: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                avatar: true,
                gender: true,
              },
            },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }

      const patientProfile = await this.prisma.patientProfile.findUnique({
        where: { id: record.patientProfileId },
        select: { patientId: true },
      });

      if (!patientProfile || patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }

      if (record.doctorId !== user.doctor.id) {
        throw new ForbiddenException('Bạn chỉ xem được hồ sơ do mình tạo');
      }
    }

    return record;
  }



  async update(id: string, dto: UpdateMedicalRecordDto, user: JwtUserPayload) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException('Bạn không có quyền sửa hồ sơ');
    }
    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }
      
      if (record.doctorId !== user.doctor.id) {
        throw new ForbiddenException('Chỉ bác sĩ tạo hồ sơ hoặc admin được sửa');
      }
    }
    // Kiểm soát luồng chuyển trạng thái
    let newStatus = record.status as MedicalRecordStatus;
    if (dto.status && dto.status !== record.status) {
      if (
        (record.status === MedicalRecordStatus.DRAFT && dto.status === MedicalRecordStatus.IN_PROGRESS) ||
        (record.status === MedicalRecordStatus.IN_PROGRESS && dto.status === MedicalRecordStatus.COMPLETED)
      ) {
        newStatus = dto.status;
      } else {
        throw new ForbiddenException('Chuyển trạng thái không hợp lệ');
      }
    }
    // Lưu lịch sử trước khi update
    await this.prisma.medicalRecordHistory.create({
      data: {
        medicalRecordId: id,
        changedBy: user.id,
        changes: { action: 'UPDATE', before: record, after: { ...record, ...dto, status: newStatus } },
      },
    });
    return await this.prisma.medicalRecord.update({
      where: { id },
      data: {
        ...(dto.content ? { content: dto.content } : {}),
        status: newStatus,
      },
    });
  }

  async remove(id: string, user: JwtUserPayload) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException('Bạn không có quyền xoá hồ sơ');
    }
    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }
      
      if (record.doctorId !== user.doctor.id) {
        throw new ForbiddenException('Chỉ bác sĩ tạo hồ sơ hoặc admin được xoá');
      }
    }
    // Xóa an toàn: tạo lịch sử, xóa histories phụ thuộc, sau đó xóa record trong transaction
    return await this.prisma.$transaction(async (tx) => {
      // Lưu lịch sử xóa vào bảng history khác record hiện tại
      await tx.medicalRecordHistory.create({
        data: {
          medicalRecordId: id,
          changedBy: user.id,
          changes: { action: 'DELETE', data: record },
        },
      });

      // Xóa tất cả history liên quan để tránh lỗi khóa ngoại
      await tx.medicalRecordHistory.deleteMany({
        where: { medicalRecordId: id },
      });

      // Cuối cùng xóa hồ sơ chính
      return await tx.medicalRecord.delete({
        where: { id },
      });
    });
  }

  async getTemplates() {
     
    return await this.prisma.template.findMany();
  }

  async getTemplateByMedicalRecord(medicalRecordId: string) {
     
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: medicalRecordId },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ');
     
    const template = await this.prisma.template.findUnique({
       
      where: { id: record.templateId },
    });
    if (!template) throw new NotFoundException('Không tìm thấy template');
     
    return template;
  }

  async getTemplateById(templateId: string) {
     
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException('Không tìm thấy template');
     
    return template;
  }

  /**
   * Lấy tất cả thông tin y tế của bệnh nhân và gộp thành một chuỗi
   * Bao gồm: nội dung bệnh án, tên dịch vụ, kết quả dịch vụ
   */
  async getPatientMedicalSummary(patientProfileId: string, user: JwtUserPayload): Promise<string> {
    // Validate patient profile exists
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      include: { patient: true },
    });
    
    if (!patientProfile) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }

    // Check permissions based on user role
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      
      // Patient can only view their own profiles
      if (patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    // Lấy tất cả thông tin y tế của bệnh nhân (không bao gồm đơn thuốc)
    const [medicalRecords, prescriptions] = await Promise.all([
      // Lấy tất cả bệnh án
      this.prisma.medicalRecord.findMany({
        where: { 
          patientProfileId,
          ...(user.role === Role.DOCTOR && user.doctor?.id ? { doctorId: user.doctor.id } : {})
        },
        include: {
          template: true,
          doctor: {
            include: {
              auth: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Lấy tất cả phiếu chỉ định dịch vụ
      this.prisma.prescription.findMany({
        where: { 
          patientProfileId,
          ...(user.role === Role.DOCTOR && user.doctor?.id ? { doctorId: user.doctor.id } : {})
        },
        include: {
          services: {
            include: {
              service: true,
              doctor: {
                include: {
                  auth: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              technician: {
                include: {
                  auth: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: { order: 'asc' },
          },
          doctor: {
            include: {
              auth: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Gộp tất cả thông tin thành một chuỗi (rút gọn)
    const summaryParts: string[] = [];

    // Nội dung bệnh án
    if (medicalRecords.length > 0) {
      medicalRecords.forEach((record, index) => {
        summaryParts.push(`Bệnh án ${index + 1}:`);
        summaryParts.push(`- Nội dung: ${JSON.stringify(record.content, null, 2)}`);
        summaryParts.push('');
      });
    }

    // Dịch vụ và kết quả
    if (prescriptions.length > 0) {
      prescriptions.forEach((prescription, index) => {
        summaryParts.push(`Phiếu chỉ định ${index + 1}:`);
        if (prescription.services.length > 0) {
          summaryParts.push(`Dịch vụ được chỉ định:`);
          prescription.services.forEach((prescriptionService, serviceIndex) => {
            summaryParts.push(`  ${serviceIndex + 1}. ${prescriptionService.service.name}`);
          });
        }
        summaryParts.push('');
      });
    }

    // Nếu không có dữ liệu
    if (medicalRecords.length === 0 && prescriptions.length === 0) {
      summaryParts.push(`Không có thông tin y tế nào được ghi nhận cho bệnh nhân này.`);
    }

    const vi = summaryParts.join('\n');
    // Translate to English with chunking and graceful fallback
    const en = await this.translationService.translateViToEn(vi);
    return en;
  }

  /**
   * Lấy thông tin summary cho một bệnh án theo mã (medicalRecordCode)
   * Bao gồm: thông tin bệnh nhân, thông tin bệnh án (1), phiếu chỉ định liên quan
   * Trả về chuỗi đã được dịch sang tiếng Anh
   */
  async getMedicalRecordSummaryByCode(
    code: string,
    user: JwtUserPayload
  ): Promise<string> {
    // 1. Tìm hồ sơ bệnh án (bao gồm patientProfile và doctor)
    const record = await this.prisma.medicalRecord.findFirst({
      where: { medicalRecordCode: code },
      include: {
        patientProfile: { include: { patient: true } },
        doctor: { include: { auth: { select: { name: true } } } },
      },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');

    // 2. Kiểm tra quyền access tương tự findOne
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      if (record.patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }
    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      if (record.doctorId !== user.doctor.id) {
        throw new ForbiddenException('Bạn chỉ xem được hồ sơ do mình tạo');
      }
    }

    // 3. Tìm các phiếu chỉ định dịch vụ liên quan đến hồ sơ này
    const prescriptions = await this.prisma.prescription.findMany({
      where: { medicalRecordId: record.id },
      include: {
        services: {
          include: {
            service: true,
            doctor: {
              include: { auth: { select: { name: true } } },
            },
            technician: {
              include: { auth: { select: { name: true } } },
            },
          },
          orderBy: { order: 'asc' },
        },
        doctor: { include: { auth: { select: { name: true } } } },
      },
    });

    // 4. Ghép summary
    const summaryParts: string[] = [];
    // Thông tin bệnh nhân
    summaryParts.push(`Tên: ${record.patientProfile.name}`);
    // Thông tin bệnh án
    summaryParts.push(`Bệnh án:`);
    summaryParts.push(`- Nội dung: ${JSON.stringify(record.content, null, 2)}`);
    summaryParts.push('');
    // Dịch vụ và kết quả nếu có
    if (prescriptions.length > 0) {
      prescriptions.forEach((prescription, index) => {
        summaryParts.push(`Phiếu chỉ định ${index + 1}:`);
        summaryParts.push(`- Mã phiếu: ${prescription.prescriptionCode}`);
        if (prescription.note) summaryParts.push(`- Ghi chú: ${prescription.note}`);
        if (prescription.services.length > 0) {
          summaryParts.push(`Dịch vụ được chỉ định:`);
          prescription.services.forEach((prescriptionService, serviceIndex) => {
            summaryParts.push(`  ${serviceIndex + 1}. ${prescriptionService.service.name}`);
            summaryParts.push(`     - Mã dịch vụ: ${prescriptionService.service.serviceCode}`);
            summaryParts.push(`     - Trạng thái: ${prescriptionService.status}`);
            if (prescriptionService.results && prescriptionService.results.length > 0) {
              summaryParts.push(`     - Kết quả: ${prescriptionService.results.join(', ')}`);
            }
            if (prescriptionService.note) {
              summaryParts.push(`     - Ghi chú: ${prescriptionService.note}`);
            }
          });
        }
        summaryParts.push('');
      });
    }
    // Nếu không có dịch vụ
    if (prescriptions.length === 0) {
      summaryParts.push(`Hồ sơ này không có phiếu chỉ định dịch vụ liên quan.`);
    }
    const vi = summaryParts.join('\n');
    const en = await this.translationService.translateViToEn(vi);
    return en;
  }

  /**
   * Lấy thông tin summary cho một bệnh án theo id (medicalRecord.id)
   * Bao gồm: thông tin bệnh nhân, nội dung bệnh án, và các phiếu chỉ định liên quan
   * Trả về chuỗi đã được dịch sang tiếng Anh
   */
  async getMedicalRecordSummaryById(
    id: string,
    user: JwtUserPayload,
  ): Promise<string> {
    // 1. Tìm hồ sơ bệnh án theo id
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        patientProfile: { include: { patient: true } },
        doctor: { include: { auth: { select: { name: true } } } },
      },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');

    // 2. Kiểm tra quyền
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      if (record.patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }
    if (user.role === Role.DOCTOR) {
      if (!user.doctor?.id) throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      if (record.doctorId !== user.doctor.id) {
        throw new ForbiddenException('Bạn chỉ xem được hồ sơ do mình tạo');
      }
    }

    // 3. Lấy phiếu chỉ định dịch vụ liên quan
    const prescriptions = await this.prisma.prescription.findMany({
      where: { medicalRecordId: record.id },
      include: {
        services: {
          include: {
            service: true,
            doctor: { include: { auth: { select: { name: true } } } },
            technician: { include: { auth: { select: { name: true } } } },
          },
          orderBy: { order: 'asc' },
        },
        doctor: { include: { auth: { select: { name: true } } } },
      },
    });

    // 4. Ghép summary (rút gọn tối đa)
    const summaryParts: string[] = [];
    // Thông tin bệnh án
    summaryParts.push(`Bệnh án:`);
    summaryParts.push(`- Nội dung: ${JSON.stringify(record.content, null, 2)}`);
    summaryParts.push('');
    // Dịch vụ và kết quả nếu có
    if (prescriptions.length > 0) {
      prescriptions.forEach((prescription, index) => {
        summaryParts.push(`Phiếu chỉ định ${index + 1}:`);
        if (prescription.note) {
          summaryParts.push(`- Ghi chú: ${prescription.note}`);
        }
        if (prescription.services.length > 0) {
          summaryParts.push(`Dịch vụ được chỉ định:`);
          prescription.services.forEach((prescriptionService, serviceIndex) => {
            summaryParts.push(`  ${serviceIndex + 1}. ${prescriptionService.service.name}`);
            if (prescriptionService.note) {
              summaryParts.push(`     - Ghi chú: ${prescriptionService.note}`);
            }
          });
        }
        summaryParts.push('');
      });
    } else {
      summaryParts.push('Hồ sơ này không có phiếu chỉ định dịch vụ liên quan.');
    }

    const vi = summaryParts.join('\n');
    const en = await this.translationService.translateViToEn(vi);

    console.log(vi);
    console.log(en);
    return en;
  }
}
