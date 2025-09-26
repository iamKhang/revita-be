/**
 * Tính toán điểm ưu tiên cho bệnh nhân
 * @param age Tuổi của bệnh nhân
 * @param checkInTime Thời gian check-in thực tế
 * @param hasAppointment Có đặt lịch trước không
 * @param appointmentTime Thời gian hẹn (nếu có)
 * @param isPregnant Có phải phụ nữ mang thai không
 * @param pregnancyWeeks Số tuần mang thai (nếu có)
 * @param hasDisability Có khuyết tật/khó khăn vận động không
 * @param isFollowUpWithin14Days Có phải tái khám trong vòng 14 ngày không
 * @param lastVisitDate Ngày khám trước (để tính tái khám)
 * @param isReturnedAfterService Có phải bệnh nhân đã quay lại sau khi đi làm dịch vụ khác không
 * @returns Điểm ưu tiên tổng cộng
 */
export function calculatePriorityScore(
  age: number,
  checkInTime: Date,
  hasAppointment: boolean = false,
  appointmentTime?: Date,
  isPregnant?: boolean,
  pregnancyWeeks?: number,
  hasDisability?: boolean,
  isFollowUpWithin14Days?: boolean,
  lastVisitDate?: Date,
  isReturnedAfterService: boolean = false,
  gender?: string,
): number {
  let totalScore = 0;

  // Người già (≥ 65 tuổi): +3 điểm
  if (age >= 65) {
    totalScore += 3;
  }

  // Trẻ nhỏ (≤ 6 tuổi): +3 điểm
  if (age <= 6) {
    totalScore += 3;
  }

  // Phụ nữ mang thai (≥ 20 tuần): +4 điểm
  if (isPregnant && pregnancyWeeks && pregnancyWeeks >= 20) {
    totalScore += 4;
  }

  // Đặt lịch trước & đến đúng giờ (±15 phút): +5 điểm
  if (hasAppointment && appointmentTime) {
    const timeDifferenceMinutes = Math.abs(
      (checkInTime.getTime() - appointmentTime.getTime()) / (1000 * 60),
    );
    if (timeDifferenceMinutes <= 15) {
      totalScore += 5;
    } else if (timeDifferenceMinutes > 15) {
      // Đặt lịch trước nhưng trễ giờ (>15 phút): +2 điểm
      totalScore += 2;
    }
  }

  // Người khuyết tật/khó khăn vận động: +4 điểm
  if (hasDisability) {
    totalScore += 4;
  }

  // Bệnh nhân tái khám trong vòng 14 ngày: +2 điểm
  if (isFollowUpWithin14Days) {
    totalScore += 2;
  } else if (lastVisitDate) {
    const daysSinceLastVisit = Math.floor(
      (Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceLastVisit <= 14) {
      totalScore += 2;
    }
  }

  // Bệnh nhân quay lại sau khi đi làm dịch vụ khác: +6 điểm
  if (isReturnedAfterService) {
    totalScore += 6;
  }

  // Ưu tiên phụ nữ cao tuổi (≥ 65 tuổi): +1 điểm
  // Chỉ áp dụng cho người già, không áp dụng cho người trẻ và trẻ em
  if (age >= 65 && gender === 'FEMALE') {
    totalScore += 1;
  }

  return totalScore;
}

/**
 * Xác định mức độ ưu tiên dựa trên điểm số
 * @param score Điểm ưu tiên
 * @returns Mức độ ưu tiên
 */
export function getPriorityLevel(
  score: number,
): 'Thấp' | 'Trung bình' | 'Cao' | 'Rất cao' {
  if (score >= 10) return 'Rất cao';
  if (score >= 7) return 'Cao';
  if (score >= 3) return 'Trung bình';  // Người cao tuổi (3 điểm) = Trung bình
  return 'Thấp';
}

/**
 * Tính toán ưu tiên đơn giản với thông tin cơ bản
 * @param age Tuổi
 * @param checkInTime Thời gian check-in
 * @param hasAppointment Có đặt lịch không
 * @param appointmentTime Thời gian hẹn (nếu có)
 * @returns Điểm ưu tiên
 */
export function calculateSimplePriority(
  age: number,
  checkInTime: Date,
  hasAppointment: boolean = false,
  appointmentTime?: Date,
  gender?: string,
): number {
  return calculatePriorityScore(
    age,
    checkInTime,
    hasAppointment,
    appointmentTime,
    undefined, // isPregnant
    undefined, // pregnancyWeeks
    undefined, // hasDisability
    undefined, // isFollowUpWithin14Days
    undefined, // lastVisitDate
    false, // isReturnedAfterService
    gender,
  );
}
