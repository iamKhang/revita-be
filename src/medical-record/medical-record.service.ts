/* eslint-disable */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TranslationService } from './translation.service';
import { EncryptionService } from './encryption.service';
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
  private readonly historyInclude = {
    select: {
      id: true,
      changedBy: true,
      changedAt: true,
      changes: true,
    },
    orderBy: {
      changedAt: 'desc' as const,
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly translationService: TranslationService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Giải mã content trong changes của history nếu có
   * @param changes - Object changes từ MedicalRecordHistory
   * @returns changes với content đã được giải mã
   */
  private decryptHistoryChanges(rawChanges: any): any {
    if (rawChanges === null || rawChanges === undefined) {
      return rawChanges;
    }

    let parsedChanges = rawChanges;

    if (typeof rawChanges === 'string') {
      try {
        parsedChanges = this.encryptionService.decrypt(rawChanges);
      } catch (error) {
        console.warn('Không thể giải mã history changes:', error);
        return rawChanges;
      }
    }

    if (typeof parsedChanges !== 'object' || parsedChanges === null) {
      return parsedChanges;
    }

    const clone =
      Array.isArray(parsedChanges) || parsedChanges === null
        ? parsedChanges
        : { ...parsedChanges };

    const decryptContent = (targetKey: 'data' | 'before' | 'after') => {
      const target = clone?.[targetKey];
      if (target && typeof target === 'object' && target.content) {
        try {
          clone[targetKey] = {
            ...target,
            content: this.encryptionService.decrypt(target.content as any),
          };
        } catch (error) {
          console.warn(
            `Không thể giải mã ${targetKey} content trong history:`,
            error,
          );
        }
      }
    };

    decryptContent('data');
    decryptContent('before');
    decryptContent('after');

    return clone;
  }

  private async populateHistoryMetadata(records: Array<{ histories?: any[] }>) {
    if (!records || records.length === 0) {
      return;
    }

    const allHistories = records.flatMap(
      (record) => record.histories ?? ([] as any[]),
    );

    if (allHistories.length === 0) {
      return;
    }

    const userIds = Array.from(
      new Set(
        allHistories
          .map((history) => history.changedBy)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const users =
      userIds.length > 0
        ? await this.prisma.auth.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true },
          })
        : [];

    const userMap = new Map(users.map((user) => [user.id, user.name]));

    records.forEach((record) => {
      if (!record.histories) {
        return;
      }
      record.histories = record.histories.map((history) => {
        const decryptedChanges = this.decryptHistoryChanges(history.changes);
        const action =
          decryptedChanges && typeof decryptedChanges === 'object'
            ? (decryptedChanges as Record<string, any>).action ?? null
            : null;
        return {
          ...history,
          changes: decryptedChanges,
          action,
          changedByName: userMap.get(history.changedBy) ?? null,
        };
      });
    });
  }

  private encryptHistoryChangesPayload(payload: any): string {
    return this.encryptionService.encrypt(payload);
  }

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

    // Nếu có appointmentCode, tìm appointment theo code và lấy id
    let appointmentId: string | undefined;
    if (dto.appointmentCode) {
      const appointment = await this.prisma.appointment.findFirst({
        where: {
          appointmentCode: dto.appointmentCode,
        },
        select: {
          id: true,
        },
      });

      if (!appointment) {
        throw new NotFoundException(
          `Không tìm thấy cuộc hẹn với mã code: ${dto.appointmentCode}`,
        );
      }

      appointmentId = appointment.id;
    }

    // Mã hóa content trước khi lưu
    const encryptedContent = this.encryptionService.encrypt(dto.content);

    const data: any = {
      patientProfileId: dto.patientProfileId,
      templateId: dto.templateId,
      content: encryptedContent as any, // Lưu dưới dạng JSON string đã mã hóa
      medicalRecordCode,
      status: MedicalRecordStatus.DRAFT,
      doctorId,
    };

    // Thêm appointmentId nếu có
    if (appointmentId) {
      data.appointmentId = appointmentId;
    }

    const created = await this.prisma.medicalRecord.create({ data });
    const historySnapshot = { ...created };
    
    // Giải mã content trước khi trả về
    const decryptedContent = this.encryptionService.decrypt(created.content as any);
    created.content = decryptedContent;
    
    // Lưu lịch sử tạo mới (lưu dữ liệu đã mã hóa để nhất quán với DB)
    await this.prisma.medicalRecordHistory.create({
      data: {
        medicalRecordId: created.id,
        changedBy: user.id,
        changes: this.encryptHistoryChangesPayload({
          action: 'CREATE',
          data: historySnapshot,
        }),
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

    // PATIENT chỉ xem được hồ sơ của chính mình
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      if (record.patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    // DOCTOR và các role khác xem được tất cả (không cần check)

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

    // Giải mã content trước khi sử dụng
    const decryptedContent = this.encryptionService.decrypt(record.content as any);
    // Notes từ content (rút gọn thành chuỗi)
    const notes = JSON.stringify(decryptedContent || {});

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

    // PATIENT chỉ xem được hồ sơ của chính mình
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      if (record.patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    // DOCTOR và các role khác xem được tất cả (không cần check)

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

    // Giải mã content trước khi sử dụng
    const decryptedContent = this.encryptionService.decrypt(record.content as any);
    // Notes từ content (rút gọn thành chuỗi) và dịch VI -> EN cho recommender
    const notesVi = JSON.stringify(decryptedContent || {});
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
      histories: this.historyInclude,
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
      
      // Giải mã content cho tất cả records
      const decryptedData = data.map(record => ({
        ...record,
        content: this.encryptionService.decrypt(record.content as any),
      }));
      await this.populateHistoryMetadata(decryptedData);
      
      return { data: decryptedData, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
    }

    // Cho DOCTOR, RECEPTIONIST, ADMIN - có thể xem tất cả
    const allWhere: any = {
      ...(patientProfileName
        ? { patientProfile: { name: { contains: patientProfileName, mode: 'insensitive' } } }
        : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.medicalRecord.count({ where: allWhere }),
      this.prisma.medicalRecord.findMany({
        where: allWhere,
        include,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      })
    ]);
    
    // Giải mã content cho tất cả records
    const decryptedData = data.map(record => ({
      ...record,
      content: this.encryptionService.decrypt(record.content as any),
    }));
    await this.populateHistoryMetadata(decryptedData);
    
    return { data: decryptedData, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }

  async findByPatientProfile(patientProfileId: string, user: JwtUserPayload, page: string = '1', limit: string = '10') {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || '10', 10) || 10, 1),
      100,
    );
    const skip = (pageNum - 1) * limitNum;
    const include = {
      histories: this.historyInclude,
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

    // PATIENT chỉ xem được hồ sơ của chính mình
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      
      // Patient can only view their own profiles
      if (patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    // DOCTOR và các role khác xem được tất cả (không cần check)
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
    
    // Giải mã content cho tất cả records
    const decryptedData = data.map(record => ({
      ...record,
      content: this.encryptionService.decrypt(record.content as any),
    }));
    await this.populateHistoryMetadata(decryptedData);
    
    return { data: decryptedData, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }


  async findOne(id: string, user: JwtUserPayload) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        histories: this.historyInclude,
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

    // PATIENT chỉ xem được hồ sơ của chính mình
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

    // DOCTOR và các role khác xem được tất cả (không cần check)

    // Giải mã content trước khi trả về
    record.content = this.encryptionService.decrypt(record.content as any);
    await this.populateHistoryMetadata([record]);

    return record;
  }


  async findByCode(code: string, user: JwtUserPayload) {
    const record = await this.prisma.medicalRecord.findFirst({
      where: { medicalRecordCode: code },
      include: {
        histories: this.historyInclude,
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

    // PATIENT chỉ xem được hồ sơ của chính mình
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

    // DOCTOR và các role khác xem được tất cả (không cần check)

    // Giải mã content trước khi trả về
    record.content = this.encryptionService.decrypt(record.content as any);
    await this.populateHistoryMetadata([record]);

    return record;
  }



  async update(id: string, dto: UpdateMedicalRecordDto, user: JwtUserPayload) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ');
    
    // PATIENT không thể sửa hồ sơ
    if (user.role === Role.PATIENT) {
      throw new ForbiddenException('Bạn không có quyền sửa hồ sơ');
    }
    
    // DOCTOR và các role khác có thể sửa (không cần check thêm)
    
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
    // Mã hóa content nếu có cập nhật
    const updateData: any = {
      status: newStatus,
    };
    
    let encryptedNewContent: any = record.content; // Giữ nguyên nếu không có cập nhật
    if (dto.content) {
      encryptedNewContent = this.encryptionService.encrypt(dto.content) as any;
      updateData.content = encryptedNewContent;
    }

    // Lưu lịch sử trước khi update (lưu dữ liệu đã mã hóa để nhất quán với DB)
    await this.prisma.medicalRecordHistory.create({
      data: {
        medicalRecordId: id,
        changedBy: user.id,
        changes: this.encryptHistoryChangesPayload({
          action: 'UPDATE',
          before: record, // record.content đã được mã hóa
          after: { ...record, ...updateData, content: encryptedNewContent },
        }),
      },
    });
    
    const updated = await this.prisma.medicalRecord.update({
      where: { id },
      data: updateData,
    });
    
    // Giải mã content trước khi trả về
    updated.content = this.encryptionService.decrypt(updated.content as any);
    
    return updated;
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
      // Lưu lịch sử xóa (record.content đã được mã hóa trong DB)
      await tx.medicalRecordHistory.create({
        data: {
          medicalRecordId: id,
          changedBy: user.id,
          changes: this.encryptHistoryChangesPayload({
            action: 'DELETE',
            data: record,
          }),
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
    return await this.prisma.template.findMany({
      include: {
        specialty: {
          select: {
            id: true,
            name: true,
            specialtyCode: true,
          },
        },
      },
    });
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

    // PATIENT chỉ xem được hồ sơ của chính mình
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      
      // Patient can only view their own profiles
      if (patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    // DOCTOR và các role khác xem được tất cả (không cần check)

    // Lấy tất cả thông tin y tế của bệnh nhân (không bao gồm đơn thuốc)
    const [medicalRecords, prescriptions] = await Promise.all([
      // Lấy tất cả bệnh án
      this.prisma.medicalRecord.findMany({
        where: { 
          patientProfileId,
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
        // Giải mã content trước khi sử dụng
        const decryptedContent = this.encryptionService.decrypt(record.content as any);
        summaryParts.push(`Bệnh án ${index + 1}:`);
        summaryParts.push(`- Nội dung: ${JSON.stringify(decryptedContent, null, 2)}`);
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

    // PATIENT chỉ xem được hồ sơ của chính mình
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      if (record.patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    // DOCTOR và các role khác xem được tất cả (không cần check)

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
    // Thông tin bệnh án - giải mã content trước khi sử dụng
    const decryptedContent = this.encryptionService.decrypt(record.content as any);
    summaryParts.push(`Bệnh án:`);
    summaryParts.push(`- Nội dung: ${JSON.stringify(decryptedContent, null, 2)}`);
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

    // PATIENT chỉ xem được hồ sơ của chính mình
    if (user.role === Role.PATIENT) {
      if (!user.patient?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      if (record.patientProfile.patientId !== user.patient.id) {
        throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
      }
    }

    // DOCTOR và các role khác xem được tất cả (không cần check)

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
    // Thông tin bệnh án - giải mã content trước khi sử dụng
    const decryptedContent = this.encryptionService.decrypt(record.content as any);
    summaryParts.push(`Bệnh án:`);
    summaryParts.push(`- Nội dung: ${JSON.stringify(decryptedContent, null, 2)}`);
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

  /**
   * Liên kết một phiếu chỉ định với bệnh án
   * @param medicalRecordId - ID của bệnh án
   * @param prescriptionCode - Mã code của phiếu chỉ định
   * @param user - Thông tin người dùng hiện tại
   * @returns Prescription đã được liên kết
   */
  async linkPrescription(
    medicalRecordId: string,
    prescriptionCode: string,
    user: JwtUserPayload,
  ) {
    // 1. Kiểm tra bệnh án tồn tại và có quyền truy cập
    const medicalRecord = await this.findOne(medicalRecordId, user);

    // 2. Tìm phiếu chỉ định theo code
    const prescription = await this.prisma.prescription.findFirst({
      where: { prescriptionCode },
      include: {
        patientProfile: true,
      },
    });

    if (!prescription) {
      throw new NotFoundException(
        `Không tìm thấy phiếu chỉ định với mã: ${prescriptionCode}`,
      );
    }

    // 3. Kiểm tra phiếu chỉ định đã được liên kết với bệnh án khác chưa
    if (prescription.medicalRecordId && prescription.medicalRecordId !== medicalRecordId) {
      throw new BadRequestException(
        `Phiếu chỉ định này đã được liên kết với bệnh án khác (ID: ${prescription.medicalRecordId})`,
      );
    }

    // 4. Kiểm tra patientProfileId có khớp không
    if (prescription.patientProfileId !== medicalRecord.patientProfileId) {
      throw new BadRequestException(
        'Phiếu chỉ định không thuộc về cùng bệnh nhân với bệnh án này',
      );
    }

    // 5. Cập nhật liên kết
    const updatedPrescription = await this.prisma.prescription.update({
      where: { id: prescription.id },
      data: {
        medicalRecordId: medicalRecordId,
      },
      include: {
        services: { include: { service: true }, orderBy: { order: 'asc' } },
        patientProfile: true,
        doctor: true,
      },
    });

    return updatedPrescription;
  }
}

