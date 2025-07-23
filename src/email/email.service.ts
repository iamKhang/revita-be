import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  /**
   * Gửi OTP qua email
   * @param email - Địa chỉ email người nhận
   * @param otp - Mã OTP
   * @param name - Tên người nhận (tùy chọn)
   */
  async sendOtp(email: string, otp: string, name?: string): Promise<boolean> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'Revita Healthcare <noreply@revita.io.vn>',
        to: [email],
        subject: 'Mã xác thực OTP - Revita Healthcare',
        html: this.generateOtpEmailTemplate(otp, name),
      });

      if (error) {
        this.logger.error('Failed to send OTP email:', error);
        return false;
      }

      this.logger.log(`OTP email sent successfully to ${email}. Message ID: ${data?.id}`);
      
      // Log OTP to console for development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔐 OTP cho email ${email}: ${otp}`);
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error sending OTP email:', error);
      return false;
    }
  }

  /**
   * Gửi email chào mừng sau khi đăng ký thành công
   * @param email - Địa chỉ email
   * @param name - Tên người dùng
   */
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'Revita Healthcare <noreply@revita.io.vn>',
        to: [email],
        subject: 'Chào mừng bạn đến với Revita Healthcare!',
        html: this.generateWelcomeEmailTemplate(name),
      });

      if (error) {
        this.logger.error('Failed to send welcome email:', error);
        return false;
      }

      this.logger.log(`Welcome email sent successfully to ${email}. Message ID: ${data?.id}`);
      return true;
    } catch (error) {
      this.logger.error('Error sending welcome email:', error);
      return false;
    }
  }

  /**
   * Tạo template HTML cho email OTP
   * @param otp - Mã OTP
   * @param name - Tên người nhận
   */
  private generateOtpEmailTemplate(otp: string, name?: string): string {
    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mã xác thực OTP</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #2c5aa0;
            margin-bottom: 10px;
          }
          .otp-code {
            background: #f8f9fa;
            border: 2px dashed #2c5aa0;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
            border-radius: 8px;
          }
          .otp-number {
            font-size: 32px;
            font-weight: bold;
            color: #2c5aa0;
            letter-spacing: 5px;
            margin: 10px 0;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏥 Revita Healthcare</div>
            <h2>Mã xác thực OTP</h2>
          </div>
          
          <p>Xin chào${name ? ` ${name}` : ''},</p>
          
          <p>Bạn đã yêu cầu mã xác thực để hoàn tất quá trình đăng ký tài khoản tại Revita Healthcare.</p>
          
          <div class="otp-code">
            <p><strong>Mã xác thực của bạn là:</strong></p>
            <div class="otp-number">${otp}</div>
            <p><em>Mã này có hiệu lực trong 5 phút</em></p>
          </div>
          
          <div class="warning">
            <strong>⚠️ Lưu ý bảo mật:</strong>
            <ul>
              <li>Không chia sẻ mã này với bất kỳ ai</li>
              <li>Revita Healthcare sẽ không bao giờ yêu cầu mã OTP qua điện thoại</li>
              <li>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email</li>
            </ul>
          </div>
          
          <p>Nếu bạn cần hỗ trợ, vui lòng liên hệ với chúng tôi qua:</p>
          <ul>
            <li>📧 Email: support@revita.io.vn</li>
            <li>📞 Hotline: 1900-xxxx</li>
          </ul>
          
          <div class="footer">
            <p>Trân trọng,<br><strong>Đội ngũ Revita Healthcare</strong></p>
            <p>Email này được gửi tự động, vui lòng không trả lời.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Tạo template HTML cho email chào mừng
   * @param name - Tên người dùng
   */
  private generateWelcomeEmailTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chào mừng đến với Revita Healthcare</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #2c5aa0;
            margin-bottom: 10px;
          }
          .welcome-box {
            background: linear-gradient(135deg, #2c5aa0, #4a90e2);
            color: white;
            padding: 25px;
            text-align: center;
            border-radius: 8px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏥 Revita Healthcare</div>
          </div>
          
          <div class="welcome-box">
            <h2>🎉 Chào mừng ${name}!</h2>
            <p>Cảm ơn bạn đã đăng ký tài khoản tại Revita Healthcare</p>
          </div>
          
          <p>Chúng tôi rất vui mừng chào đón bạn tham gia cộng đồng chăm sóc sức khỏe của Revita Healthcare!</p>
          
          <div class="footer">
            <p>Trân trọng,<br><strong>Đội ngũ Revita Healthcare</strong></p>
            <p>Email này được gửi tự động, vui lòng không trả lời.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
