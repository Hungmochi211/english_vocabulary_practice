import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPasswordResetOtpEmail(params: {
  fullName: string;
  otp: string;
  expiresMinutes?: number;
}): { subject: string; text: string; html: string } {
  const safeNameText = (params.fullName || 'Học viên / Learner').trim();
  const safeNameHtml = escapeHtml(safeNameText);
  const safeOtp = escapeHtml(params.otp.trim());
  const expiresMinutes = params.expiresMinutes ?? 10;

  const subject = `[LexiTag] Mã OTP khôi phục mật khẩu / Password Reset Code: ${params.otp.trim()}`;

  const text = [
    `LEXITAG LEARNING LAB — KHÔI PHỤC MẬT KHẨU / PASSWORD RESET`,
    `============================================================`,
    ``,
    `[TIẾNG VIỆT]`,
    `Xin chào ${safeNameText},`,
    ``,
    `Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản LexiTag của bạn.`,
    `Mã xác thực OTP 6 chữ số của bạn là: ${params.otp.trim()}`,
    ``,
    `- Hiệu lực: ${expiresMinutes} phút (chỉ sử dụng 1 lần, tối đa 5 lần nhập sai).`,
    `- Bảo mật: Tuyệt đối không chia sẻ mã này cho bất kỳ ai.`,
    `- Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này; mật khẩu của bạn vẫn an toàn.`,
    ``,
    `------------------------------------------------------------`,
    ``,
    `[ENGLISH]`,
    `Hello ${safeNameText},`,
    ``,
    `We received a request to reset the password for your LexiTag account.`,
    `Your 6-digit verification code (OTP) is: ${params.otp.trim()}`,
    ``,
    `- Validity: ${expiresMinutes} minutes (single-use only, up to 5 incorrect attempts).`,
    `- Security: Never share this code with anyone, including LexiTag staff.`,
    `- If you did not request a password reset, you can safely ignore this email.`,
    ``,
    `============================================================`,
    `Đây là email tự động, vui lòng không trả lời / This is an automated email, please do not reply.`,
    `© 2026 LexiTag Learning Lab`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#312e81 100%);padding:28px 32px;text-align:center;">
              <div style="font-size:22px;font-weight:800;letter-spacing:0.3px;color:#ffffff;">
                LexiTag Learning Lab
              </div>
              <div style="margin-top:6px;font-size:13px;color:#c7d2fe;">
                Khôi phục mật khẩu tài khoản &bull; Account Password Reset
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <!-- Vietnamese Section -->
              <div style="margin-bottom:4px;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#4f46e5;">
                Tiếng Việt
              </div>
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#1e293b;">
                Xin chào <strong>${safeNameHtml}</strong>,
              </p>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.65;color:#475569;">
                Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>LexiTag</strong> của bạn. Vui lòng sử dụng mã xác thực OTP 6 chữ số dưới đây để hoàn tất:
              </p>

              <!-- OTP Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td align="center" style="background-color:#eef2ff;border:2px dashed #6366f1;border-radius:12px;padding:20px 16px;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#4338ca;margin-bottom:8px;">
                      MÃ XÁC THỰC / VERIFICATION CODE
                    </div>
                    <div style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:800;letter-spacing:10px;color:#1e1b4b;padding-left:10px;">
                      ${safeOtp}
                    </div>
                    <div style="margin-top:10px;font-size:12px;color:#475569;">
                      Hiệu lực <strong>${expiresMinutes} phút</strong> &bull; Valid for <strong>${expiresMinutes} minutes</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <ul style="margin:0 0 24px 0;padding-left:18px;font-size:13px;line-height:1.65;color:#475569;">
                <li>Mã chỉ có hiệu lực <strong>1 lần duy nhất</strong> (tối đa 5 lần nhập sai).</li>
                <li>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — tài khoản của bạn vẫn an toàn.</li>
              </ul>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />

              <!-- English Section -->
              <div style="margin-bottom:4px;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#4f46e5;">
                English
              </div>
              <p style="margin:0 0 10px 0;font-size:15px;line-height:1.6;color:#1e293b;">
                Hello <strong>${safeNameHtml}</strong>,
              </p>
              <p style="margin:0 0 12px 0;font-size:14px;line-height:1.65;color:#475569;">
                We received a request to reset the password for your <strong>LexiTag</strong> account. Please enter the 6-digit verification code above to set a new password.
              </p>
              <ul style="margin:0 0 22px 0;padding-left:18px;font-size:13px;line-height:1.65;color:#475569;">
                <li>This code expires in <strong>${expiresMinutes} minutes</strong> and is valid for <strong>single use only</strong> (up to 5 failed attempts).</li>
                <li>If you did not request this change, you can safely ignore this email — your password will remain unchanged.</li>
              </ul>

              <!-- Security Warning -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;padding:12px 16px;font-size:12.5px;line-height:1.6;color:#92400e;">
                    <strong>Lưu ý bảo mật / Security Notice:</strong> Tuyệt đối không chia sẻ mã OTP này cho bất kỳ ai. Never share this OTP code with anyone, including LexiTag staff.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 32px;text-align:center;font-size:12px;line-height:1.6;color:#64748b;">
              Đây là email tự động, vui lòng không trả lời &bull; This is an automated message, please do not reply.<br />
              &copy; 2026 <strong>LexiTag Learning Lab</strong> &mdash; Smart English Vocabulary Platform
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

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

    const fromAddress =
      process.env.SMTP_FROM || '"LexiTag Learning Lab" <no-reply@lexitag.vn>';
    const { subject, text, html } = buildPasswordResetOtpEmail({
      fullName,
      otp,
      expiresMinutes: 10,
    });

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to: email,
        subject,
        text,
        html,
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
