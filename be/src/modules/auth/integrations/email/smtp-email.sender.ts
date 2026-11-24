import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { EmailSender } from '../../interfaces/email-sender.interface';

@Injectable()
export class SmtpEmailSender implements EmailSender {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST') && this.config.get<string>('EMAIL_FROM'));
  }

  async sendOtp(email: string, purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET', otp: string): Promise<void> {
    if (!this.isConfigured()) throw new Error('SMTP is not configured');
    const host = this.config.getOrThrow<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER', '');
    const password = this.config.get<string>('SMTP_PASSWORD', '');
    const transporter = nodemailer.createTransport({
      host,
      port: this.config.getOrThrow<number>('SMTP_PORT'),
      secure: this.config.getOrThrow<boolean>('SMTP_SECURE'),
      ...(user ? { auth: { user, pass: password } } : {}),
    });
    const verification = purpose === 'EMAIL_VERIFICATION';
    await transporter.sendMail({
      from: this.config.getOrThrow<string>('EMAIL_FROM'),
      to: email,
      subject: verification ? 'Xác minh tài khoản Hành Trình Việt' : 'Đặt lại mật khẩu Hành Trình Việt',
      text: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 10 phút. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.`,
    });
  }
}
