import { Injectable } from '@nestjs/common';
import { PatientPriorityInfo, PriorityLevel, PriorityCalculationRules } from './priority.interface';

@Injectable()
export class PriorityCalculatorService {
  private readonly rules: PriorityCalculationRules = {
    // Điểm cơ bản
    baseScore: 100,
    
    // Điểm cho người già (>= 65 tuổi)
    elderlyScore: 200,
    elderlyAgeMultiplier: 2, // Nhân với tuổi
    
    // Điểm cho trẻ em (< 6 tuổi)
    childScore: 300,
    childAgeMultiplier: 10, // Nhân với (6 - tuổi)
    
    // Điểm cho phụ nữ mang thai
    pregnantScore: 400,
    pregnancyWeekMultiplier: 5, // Nhân với số tuần thai
    
    // Điểm cho người khuyết tật
    disabledScore: 500,
    
    // Điểm cho RETURN_AFTER_RESULT (luôn ở đầu queue)
    returnAfterResultScore: 10000,
  };

  /**
   * Tính điểm ưu tiên cho bệnh nhân
   */
  calculatePriorityScore(patientInfo: Omit<PatientPriorityInfo, 'priorityScore' | 'priorityLevel'>): number {
    let score = this.rules.baseScore;

    // 1. Người già (>= 65 tuổi) - tuổi càng cao điểm càng cao
    if (patientInfo.isElderly && patientInfo.age >= 65) {
      score += this.rules.elderlyScore + (patientInfo.age * this.rules.elderlyAgeMultiplier);
    }

    // 2. Trẻ em (< 6 tuổi) - tuổi càng nhỏ điểm càng cao
    if (patientInfo.isChild && patientInfo.age < 6) {
      score += this.rules.childScore + ((6 - patientInfo.age) * this.rules.childAgeMultiplier);
    }

    // 3. Phụ nữ mang thai - tuần thai càng nhiều điểm càng cao
    if (patientInfo.isPregnant && patientInfo.pregnancyWeeks) {
      score += this.rules.pregnantScore + (patientInfo.pregnancyWeeks * this.rules.pregnancyWeekMultiplier);
    }

    // 4. Người khuyết tật
    if (patientInfo.isDisabled) {
      score += this.rules.disabledScore;
    }

    // 5. RETURN_AFTER_RESULT luôn có điểm cao nhất
    if (patientInfo.queueStatus === 'RETURN_AFTER_RESULT') {
      score += this.rules.returnAfterResultScore;
    }

    return Math.round(score);
  }

  /**
   * Xác định mức độ ưu tiên dựa trên điểm số
   */
  determinePriorityLevel(score: number): PriorityLevel {
    if (score >= 10000) {
      return PriorityLevel.VERY_HIGH; // RETURN_AFTER_RESULT
    } else if (score >= 1000) {
      return PriorityLevel.HIGH; // Người khuyết tật, mang thai nhiều tuần
    } else if (score >= 500) {
      return PriorityLevel.NORMAL; // Người già, trẻ em, mang thai ít tuần
    } else {
      return PriorityLevel.LOW; // Bệnh nhân thường
    }
  }

  /**
   * Tính toán thông tin ưu tiên đầy đủ
   */
  calculatePatientPriority(patientInfo: Omit<PatientPriorityInfo, 'priorityScore' | 'priorityLevel'>): PatientPriorityInfo {
    const priorityScore = this.calculatePriorityScore(patientInfo);
    const priorityLevel = this.determinePriorityLevel(priorityScore);

    return {
      ...patientInfo,
      priorityScore,
      priorityLevel,
    };
  }

  /**
   * Tính thời gian chờ ước tính dựa trên vị trí trong queue
   */
  calculateEstimatedWaitTime(queuePosition: number, averageServiceTime: number = 15): number {
    // Thời gian chờ = vị trí trong queue * thời gian trung bình mỗi dịch vụ
    return queuePosition * averageServiceTime;
  }

  /**
   * So sánh ưu tiên giữa hai bệnh nhân
   * @returns -1 nếu a có ưu tiên cao hơn b, 1 nếu ngược lại, 0 nếu bằng nhau
   */
  comparePriority(a: PatientPriorityInfo, b: PatientPriorityInfo): number {
    // RETURN_AFTER_RESULT luôn ưu tiên cao nhất
    if (a.queueStatus === 'RETURN_AFTER_RESULT' && b.queueStatus !== 'RETURN_AFTER_RESULT') {
      return -1;
    }
    if (b.queueStatus === 'RETURN_AFTER_RESULT' && a.queueStatus !== 'RETURN_AFTER_RESULT') {
      return 1;
    }

    // So sánh điểm ưu tiên (điểm cao hơn = ưu tiên cao hơn)
    if (a.priorityScore !== b.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }

    // Nếu điểm bằng nhau, ưu tiên người đến trước
    return a.joinedAt.getTime() - b.joinedAt.getTime();
  }

  /**
   * Lấy thông tin ưu tiên từ dữ liệu bệnh nhân
   */
  extractPriorityInfoFromPatient(patientData: any): Omit<PatientPriorityInfo, 'priorityScore' | 'priorityLevel' | 'queueStatus' | 'queuePosition' | 'estimatedWaitTime' | 'joinedAt' | 'lastUpdatedAt'> {
    const age = this.calculateAge(patientData.dateOfBirth);
    
    return {
      patientProfileId: patientData.id,
      patientName: patientData.name,
      age,
      gender: patientData.gender,
      isPregnant: patientData.isPregnant || false,
      pregnancyWeeks: patientData.pregnancyWeeks,
      isDisabled: patientData.isDisabled || false,
      isElderly: age >= 65,
      isChild: age < 6,
      prescriptionId: patientData.prescriptionId,
      prescriptionCode: patientData.prescriptionCode,
      serviceId: patientData.serviceId,
      serviceName: patientData.serviceName,
      boothId: patientData.boothId,
      boothCode: patientData.boothCode,
      clinicRoomId: patientData.clinicRoomId,
      clinicRoomName: patientData.clinicRoomName,
    };
  }

  /**
   * Tính tuổi từ ngày sinh
   */
  private calculateAge(dateOfBirth: Date | string): number {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Lấy cấu hình quy tắc tính điểm
   */
  getPriorityRules(): PriorityCalculationRules {
    return { ...this.rules };
  }

  /**
   * Cập nhật cấu hình quy tắc tính điểm
   */
  updatePriorityRules(newRules: Partial<PriorityCalculationRules>): void {
    Object.assign(this.rules, newRules);
  }
}
