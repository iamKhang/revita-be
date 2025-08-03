import { Injectable, Logger } from '@nestjs/common';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private snsClient: SNSClient;

  constructor() {
    this.snsClient = new SNSClient({
      region: process.env.AWS_REGION || 'ap-southeast-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  /**
   * Gửi OTP qua SMS
   * @param phoneNumber - Số điện thoại người nhận (định dạng +84xxxxxxxxx)
   * @param otp - Mã OTP
   */
  async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
    try {
      // Chuẩn hóa số điện thoại
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const message = this.generateOtpSmsMessage(otp);

      // Chỉ gửi SMS thực tế trong môi trường PRODUCTION
      if (process.env.NODE_ENV === 'production') {
        const command = new PublishCommand({
          TopicArn: process.env.AWS_SNS_TOPIC_ARN,
          Message: JSON.stringify({
            default: message,
            sms: message,
          }),
          MessageStructure: 'json',
          MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: 'Revita',
            },
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
          Subject: 'OTP Verification - Revita Healthcare',
        });

        const result = await this.snsClient.send(command);

        if (result.MessageId) {
          this.logger.log(`OTP SMS sent successfully to ${formattedPhone}. Message ID: ${result.MessageId}`);
          return true;
        } else {
          this.logger.error('Failed to send OTP SMS: No message ID returned');
          return false;
        }
      } else {
        // Môi trường development/test: chỉ log tin nhắn, không gửi thật
        this.logger.log(`[${process.env.NODE_ENV?.toUpperCase() || 'NON-PRODUCTION'}] SMS simulation - OTP to ${formattedPhone}: ${message}`);
        console.log(`🔐 OTP cho SMS ${formattedPhone}: ${otp}`);
        return true;
      }
    } catch (error) {
      this.logger.error('Error sending OTP SMS:', error);
      return false;
    }
  }

  /**
   * Gửi SMS thông báo đăng ký thành công
   * @param phoneNumber - Số điện thoại
   * @param name - Tên người dùng
   */
  async sendWelcomeSms(phoneNumber: string, name: string): Promise<boolean> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const message = this.generateWelcomeSmsMessage(name);

      // Chỉ gửi SMS thực tế trong môi trường PRODUCTION
      if (process.env.NODE_ENV === 'production') {
        const command = new PublishCommand({
          TopicArn: process.env.AWS_SNS_TOPIC_ARN,
          Message: JSON.stringify({
            default: message,
            sms: message,
          }),
          MessageStructure: 'json',
          MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: 'Revita',
            },
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Promotional',
            },
          },
          Subject: 'Welcome - Revita Healthcare',
        });

        const result = await this.snsClient.send(command);

        if (result.MessageId) {
          this.logger.log(`Welcome SMS sent successfully to ${formattedPhone}. Message ID: ${result.MessageId}`);
          return true;
        } else {
          this.logger.error('Failed to send welcome SMS: No message ID returned');
          return false;
        }
      } else {
        // Môi trường development/test: chỉ log tin nhắn, không gửi thật
        this.logger.log(`[${process.env.NODE_ENV?.toUpperCase() || 'NON-PRODUCTION'}] SMS simulation - Welcome to ${formattedPhone}: ${message}`);
        console.log(`📱 Welcome SMS cho ${formattedPhone}: ${message}`);
        return true;
      }
    } catch (error) {
      this.logger.error('Error sending welcome SMS:', error);
      return false;
    }
  }

  /**
   * Chuẩn hóa số điện thoại về định dạng quốc tế
   * @param phoneNumber - Số điện thoại đầu vào
   * @returns Số điện thoại đã chuẩn hóa
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Loại bỏ tất cả ký tự không phải số
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Nếu bắt đầu bằng 0, thay thế bằng 84
    if (cleaned.startsWith('0')) {
      cleaned = '84' + cleaned.substring(1);
    }
    
    // Nếu chưa có mã quốc gia, thêm 84
    if (!cleaned.startsWith('84')) {
      cleaned = '84' + cleaned;
    }
    
    return '+' + cleaned;
  }

  /**
   * Tạo nội dung SMS cho OTP
   * @param otp - Mã OTP
   */
  private generateOtpSmsMessage(otp: string): string {
    return `[Revita Healthcare] Ma xac thuc OTP cua ban la: ${otp}. Ma co hieu luc trong 5 phut. Khong chia se ma nay voi bat ky ai.`;
  }

  /**
   * Tạo nội dung SMS chào mừng
   * @param name - Tên người dùng
   */
  private generateWelcomeSmsMessage(name: string): string {
    return `Chao mung ${name} den voi Revita Healthcare! Cam on ban da dang ky tai khoan. Tai app: https://revita.io.vn`;
  }
}
