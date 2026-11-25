import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class PasswordResetMailService {
  private readonly logger = new Logger(PasswordResetMailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  }

  async sendPasswordResetOtp(email: string, fullName: string, otp: string): Promise<void> {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_USER || 'no-reply@vocab-practice.local',
        to: email,
        subject: `[LexiTag] Mã OTP khôi phục mật khẩu của bạn: ${otp}`,
        text: [
          `Xin chào ${fullName},`,
          '',
          `Mã OTP khôi phục mật khẩu tài khoản LexiTag của bạn là: ${otp}`,
          'Mã có hiệu lực trong 10 phút và chỉ sử dụng được 1 lần (tối đa 5 lần nhập sai).',
          '',
          'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.',
        ].join('\n'),
      });
    } catch (err) {
      this.logger.warn(
        `[SMTP_RESET_OTP_FAILED] Failed to send OTP email: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Dịch vụ gửi email tạm thời gián đoạn, vui lòng thử lại sau ít phút',
        details: null,
      });
    }
  }
}
