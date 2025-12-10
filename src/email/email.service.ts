import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  private isDryRun(): boolean {
    // If EMAIL_DRY_RUN is 'true', do not send emails; only log to console
    // Useful for local development/testing
    return String(process.env.EMAIL_DRY_RUN).toLowerCase() === 'true';
  }

  /**
   * Gửi OTP qua email
   * @param email - Địa chỉ email người nhận
   * @param otp - Mã OTP
   * @param name - Tên người nhận (tùy chọn)
   */
  async sendOtp(email: string, otp: string, name?: string): Promise<boolean> {
    try {
      if (this.isDryRun()) {
        console.log('[EMAIL_DRY_RUN] sendOtp', {
          to: email,
          subject: 'Mã xác thực OTP - Revita Healthcare',
          otp,
          name,
        });
        return true;
      }
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

      this.logger.log(
        `OTP email sent successfully to ${email}. Message ID: ${data?.id}`,
      );

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
      if (this.isDryRun()) {
        console.log('[EMAIL_DRY_RUN] sendWelcomeEmail', {
          to: email,
          subject: 'Chào mừng bạn đến với Revita Healthcare!',
          name,
        });
        return true;
      }
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

      this.logger.log(
        `Welcome email sent successfully to ${email}. Message ID: ${data?.id}`,
      );
      return true;
    } catch (error) {
      this.logger.error('Error sending welcome email:', error);
      return false;
    }
  }

  /**
   * Gửi email thông báo hủy lịch hẹn
   */
  async sendAppointmentCancellationEmail(params: {
    to: string;
    patientName?: string;
    appointmentCode?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    doctorName?: string;
    reason?: string;
  }): Promise<boolean> {
    const {
      to,
      patientName,
      appointmentCode,
      date,
      startTime,
      endTime,
      doctorName,
      reason,
    } = params;
    const subject = 'Thông báo hủy lịch hẹn - Revita Healthcare';
    const html = this.generateAppointmentCancellationTemplate({
      patientName,
      appointmentCode,
      date,
      startTime,
      endTime,
      doctorName,
      reason,
    });

    try {
      if (this.isDryRun()) {
        console.log('[EMAIL_DRY_RUN] sendAppointmentCancellationEmail', {
          to,
          subject,
          appointmentCode,
          date,
          startTime,
          endTime,
          doctorName,
        });
        return true;
      }

      const { data, error } = await this.resend.emails.send({
        from: 'Revita Healthcare <noreply@revita.io.vn>',
        to: [to],
        subject,
        html,
      });

      if (error) {
        this.logger.error(
          'Failed to send appointment cancellation email:',
          error,
        );
        return false;
      }

      this.logger.log(
        `Appointment cancellation email sent to ${to}. Message ID: ${data?.id}`,
      );
      return true;
    } catch (error) {
      this.logger.error('Error sending appointment cancellation email:', error);
      return false;
    }
  }

  private generateAppointmentCancellationTemplate(params: {
    patientName?: string;
    appointmentCode?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    doctorName?: string;
    reason?: string;
  }): string {
    const {
      patientName,
      appointmentCode,
      date,
      startTime,
      endTime,
      doctorName,
      reason,
    } = params;

    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thông báo hủy lịch hẹn</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            max-width: 640px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f6fb;
          }
          .container {
            background: #ffffff;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 22px;
          }
          .logo {
            font-size: 22px;
            font-weight: 700;
            color: #1d4ed8;
          }
          .badge {
            display: inline-block;
            padding: 8px 14px;
            border-radius: 999px;
            background: #fee2e2;
            color: #b91c1c;
            font-weight: 600;
            font-size: 12px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            margin-bottom: 12px;
          }
          .hero {
            background: linear-gradient(135deg, #ef4444, #f97316);
            color: #fff;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 18px;
            text-align: center;
          }
          .card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 16px;
            margin: 16px 0;
          }
          .card h3 {
            margin: 0 0 10px 0;
            font-size: 15px;
            color: #0f172a;
          }
          ul {
            padding-left: 18px;
            margin: 0;
          }
          li {
            margin-bottom: 6px;
          }
          .reason {
            margin-top: 8px;
            padding: 12px 14px;
            border-left: 4px solid #ef4444;
            background: #fff7f7;
            border-radius: 8px;
            color: #991b1b;
          }
          .footer {
            margin-top: 20px;
            font-size: 13px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge">Lịch hẹn đã hủy</div>
            <div class="logo">🏥 Revita Healthcare</div>
          </div>
          <div class="hero">
            <h2 style="margin: 0;">Xin lỗi về sự bất tiện, ${
              patientName || 'Quý khách'
            }</h2>
            <p style="margin: 6px 0 0 0; font-size: 14px;">
              Lịch hẹn của bạn đã được hủy. Vui lòng xem chi tiết bên dưới.
            </p>
          </div>

          <div class="card">
            <h3>Chi tiết lịch hẹn</h3>
            <ul>
              ${
                appointmentCode
                  ? `<li><strong>Mã lịch hẹn:</strong> ${appointmentCode}</li>`
                  : ''
              }
              ${date ? `<li><strong>Ngày:</strong> ${date}</li>` : ''}
              ${
                startTime || endTime
                  ? `<li><strong>Thời gian:</strong> ${startTime || ''}${
                      startTime && endTime ? ' - ' : ''
                    }${endTime || ''}</li>`
                  : ''
              }
              ${
                doctorName
                  ? `<li><strong>Bác sĩ:</strong> ${doctorName}</li>`
                  : ''
              }
            </ul>
            <div class="reason">
              <strong>Lý do:</strong>
              <span>${
                reason ||
                'Lịch hẹn được hủy theo yêu cầu hoặc điều chỉnh từ phòng khám.'
              }</span>
            </div>
          </div>

          <p>
            Chúng tôi rất tiếc về sự bất tiện này. Nếu cần đặt lại lịch hoặc hỗ trợ thêm,
            vui lòng liên hệ hotline hoặc phản hồi lại email này.
          </p>
          <p>Cảm ơn bạn đã tin tưởng Revita Healthcare.</p>
          <div class="footer">
            Đây là email tự động, vui lòng không trả lời trực tiếp.
          </div>
        </div>
      </body>
      </html>
    `;
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

  /**
   * Gửi thông tin tài khoản cho nhân viên mới
   */
  async sendAccountCredentials(params: {
    email: string;
    name: string;
    username: string;
    password: string;
    role?: string;
  }): Promise<boolean> {
    const { email, name, username, password, role } = params;
    try {
      if (this.isDryRun()) {
        console.log('[EMAIL_DRY_RUN] sendAccountCredentials', {
          to: email,
          subject: 'Thông tin tài khoản nhân viên - Revita Healthcare',
          name,
          username,
          password,
          role,
        });
        return true;
      }
      const { data, error } = await this.resend.emails.send({
        from: 'Revita Healthcare <noreply@revita.io.vn>',
        to: [email],
        subject: 'Thông tin tài khoản nhân viên - Revita Healthcare',
        html: this.generateCredentialsTemplate({
          name,
          username,
          password,
          role,
        }),
      });
      if (error) {
        this.logger.error('Failed to send credentials email:', error);
        return false;
      }
      this.logger.log(`Credentials email sent to ${email}. ID: ${data?.id}`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔐 Tài khoản: ${username} | Mật khẩu: ${password}`);
      }
      return true;
    } catch (error) {
      this.logger.error('Error sending credentials email:', error);
      return false;
    }
  }

  private generateCredentialsTemplate(params: {
    name: string;
    username: string;
    password: string;
    role?: string;
  }): string {
    const { name, username, password, role } = params;
    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thông tin tài khoản nhân viên</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
          .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 22px; font-weight: bold; color: #2c5aa0; }
          .box { background: #f8f9fa; border: 1px solid #e9ecef; padding: 16px; border-radius: 8px; }
          .label { color: #6c757d; font-size: 13px; }
          .value { font-weight: 600; font-size: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏥 Revita Healthcare</div>
            <h2>Thông tin tài khoản nhân viên</h2>
          </div>
          <p>Xin chào ${name},</p>
          <p>Tài khoản làm việc tại Revita Healthcare của bạn đã được tạo${role ? ` cho vai trò <strong>${role}</strong>` : ''}.</p>
          <div class="box">
            <div class="label">Tên đăng nhập</div>
            <div class="value">${username}</div>
            <div class="label" style="margin-top:10px;">Mật khẩu tạm thời</div>
            <div class="value">${password}</div>
          </div>
          <p>Vui lòng đăng nhập và đổi mật khẩu ngay sau lần đăng nhập đầu tiên để bảo mật tài khoản.</p>
          <p>Trân trọng,<br/>Đội ngũ Revita Healthcare</p>
        </div>
      </body>
      </html>
    `;
  }
}
