import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export enum LoyaltyTier {
  NONE = 'NONE', // Chưa có hạng
  SILVER = 'SILVER', // Bạc: 100 điểm
  GOLD = 'GOLD', // Vàng: 500 điểm
  PLATINUM = 'PLATINUM', // Bạch kim: 1000 điểm
}

export interface LoyaltyTierInfo {
  tier: LoyaltyTier;
  name: string;
  discountPercent: number;
  minPoints: number;
  nextTierPoints?: number;
}

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  // Cấu hình: 1 điểm = 30,000 VNĐ
  private readonly POINTS_PER_30000_VND = 1;

  // Ngưỡng điểm cho từng hạng
  private readonly TIER_THRESHOLDS = {
    [LoyaltyTier.SILVER]: 100,
    [LoyaltyTier.GOLD]: 500,
    [LoyaltyTier.PLATINUM]: 1000,
  };

  // Phần trăm giảm giá cho từng hạng
  private readonly TIER_DISCOUNTS = {
    [LoyaltyTier.NONE]: 0,
    [LoyaltyTier.SILVER]: 5,
    [LoyaltyTier.GOLD]: 10,
    [LoyaltyTier.PLATINUM]: 15,
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tính số điểm loyalty từ giá trị dịch vụ (VNĐ)
   * @param amount - Giá trị dịch vụ (VNĐ)
   * @returns Số điểm được cộng
   */
  calculatePointsFromAmount(amount: number): number {
    // Làm tròn xuống: 30,000 VNĐ = 1 điểm
    return Math.floor(amount / 30000) * this.POINTS_PER_30000_VND;
  }

  /**
   * Xác định hạng loyalty dựa trên tổng điểm
   * @param totalPoints - Tổng điểm hiện tại
   * @returns Hạng loyalty
   */
  getLoyaltyTier(totalPoints: number): LoyaltyTier {
    if (totalPoints >= this.TIER_THRESHOLDS[LoyaltyTier.PLATINUM]) {
      return LoyaltyTier.PLATINUM;
    }
    if (totalPoints >= this.TIER_THRESHOLDS[LoyaltyTier.GOLD]) {
      return LoyaltyTier.GOLD;
    }
    if (totalPoints >= this.TIER_THRESHOLDS[LoyaltyTier.SILVER]) {
      return LoyaltyTier.SILVER;
    }
    return LoyaltyTier.NONE;
  }

  /**
   * Lấy thông tin chi tiết về hạng loyalty
   * @param totalPoints - Tổng điểm hiện tại
   * @returns Thông tin hạng loyalty
   */
  getLoyaltyTierInfo(totalPoints: number): LoyaltyTierInfo {
    const tier = this.getLoyaltyTier(totalPoints);
    const discountPercent = this.TIER_DISCOUNTS[tier];
    const minPoints = tier === LoyaltyTier.NONE ? 0 : this.TIER_THRESHOLDS[tier];

    // Tính điểm cần để lên hạng tiếp theo
    let nextTierPoints: number | undefined;
    if (tier === LoyaltyTier.NONE) {
      nextTierPoints = this.TIER_THRESHOLDS[LoyaltyTier.SILVER];
    } else if (tier === LoyaltyTier.SILVER) {
      nextTierPoints = this.TIER_THRESHOLDS[LoyaltyTier.GOLD];
    } else if (tier === LoyaltyTier.GOLD) {
      nextTierPoints = this.TIER_THRESHOLDS[LoyaltyTier.PLATINUM];
    }

    const tierNames = {
      [LoyaltyTier.NONE]: 'Chưa có hạng',
      [LoyaltyTier.SILVER]: 'Bạc',
      [LoyaltyTier.GOLD]: 'Vàng',
      [LoyaltyTier.PLATINUM]: 'Bạch kim',
    };

    return {
      tier,
      name: tierNames[tier],
      discountPercent,
      minPoints,
      nextTierPoints,
    };
  }

  /**
   * Tính giá sau khi áp dụng giảm giá loyalty
   * @param originalPrice - Giá gốc
   * @param totalPoints - Tổng điểm hiện tại của bệnh nhân
   * @returns Giá sau giảm và thông tin giảm giá
   */
  applyLoyaltyDiscount(
    originalPrice: number,
    totalPoints: number,
  ): {
    originalPrice: number;
    discountPercent: number;
    discountAmount: number;
    finalPrice: number;
    tierInfo: LoyaltyTierInfo;
  } {
    const tierInfo = this.getLoyaltyTierInfo(totalPoints);
    const discountPercent = tierInfo.discountPercent;
    const discountAmount = (originalPrice * discountPercent) / 100;
    const finalPrice = originalPrice - discountAmount;

    return {
      originalPrice,
      discountPercent,
      discountAmount: Math.round(discountAmount),
      finalPrice: Math.round(finalPrice),
      tierInfo,
    };
  }

  /**
   * Cộng điểm loyalty cho bệnh nhân sau khi thanh toán
   * @param patientId - ID của bệnh nhân (Patient)
   * @param amount - Giá trị dịch vụ đã thanh toán (VNĐ)
   * @returns Thông tin điểm đã cộng và hạng mới
   */
  async addLoyaltyPoints(
    patientId: string,
    amount: number,
  ): Promise<{
    pointsAdded: number;
    totalPoints: number;
    previousTier: LoyaltyTier;
    newTier: LoyaltyTier;
    tierInfo: LoyaltyTierInfo;
  }> {
    // Lấy thông tin bệnh nhân hiện tại
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, loyaltyPoints: true },
    });

    if (!patient) {
      this.logger.warn(`Patient not found: ${patientId}`);
      throw new Error(`Patient not found: ${patientId}`);
    }

    const previousPoints = patient.loyaltyPoints || 0;
    const previousTier = this.getLoyaltyTier(previousPoints);

    // Tính điểm được cộng
    const pointsAdded = this.calculatePointsFromAmount(amount);
    const newTotalPoints = previousPoints + pointsAdded;
    const newTier = this.getLoyaltyTier(newTotalPoints);
    const tierInfo = this.getLoyaltyTierInfo(newTotalPoints);

    // Cập nhật điểm trong database
    await this.prisma.patient.update({
      where: { id: patientId },
      data: { loyaltyPoints: newTotalPoints },
    });

    this.logger.log(
      `Added ${pointsAdded} points to patient ${patientId}. Total: ${previousPoints} -> ${newTotalPoints}. Tier: ${previousTier} -> ${newTier}`,
    );

    return {
      pointsAdded,
      totalPoints: newTotalPoints,
      previousTier,
      newTier,
      tierInfo,
    };
  }

  /**
   * Lấy thông tin loyalty của bệnh nhân
   * @param patientId - ID của bệnh nhân (Patient)
   * @returns Thông tin loyalty hiện tại
   */
  async getPatientLoyaltyInfo(patientId: string): Promise<{
    totalPoints: number;
    tierInfo: LoyaltyTierInfo;
  } | null> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { loyaltyPoints: true },
    });

    if (!patient) {
      return null;
    }

    const totalPoints = patient.loyaltyPoints || 0;
    const tierInfo = this.getLoyaltyTierInfo(totalPoints);

    return {
      totalPoints,
      tierInfo,
    };
  }

  /**
   * Lấy thông tin loyalty từ patientProfileId
   * Tìm patientId từ patientProfile
   * @param patientProfileId - ID của patient profile
   * @returns Thông tin loyalty hoặc null nếu không có patient
   */
  async getLoyaltyInfoFromPatientProfile(
    patientProfileId: string,
  ): Promise<{
    totalPoints: number;
    tierInfo: LoyaltyTierInfo;
  } | null> {
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      select: { patientId: true },
    });

    if (!patientProfile || !patientProfile.patientId) {
      return null;
    }

    return this.getPatientLoyaltyInfo(patientProfile.patientId);
  }
}

