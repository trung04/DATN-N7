import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type {
  NotificationEmailMessage,
  NotificationEmailSender,
} from '../../interfaces/notification-email-sender.interface';

@Injectable()
export class SmtpNotificationEmailSender implements NotificationEmailSender {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('SMTP_HOST') &&
        this.config.get<string>('EMAIL_FROM'),
    );
  }

  async send(message: NotificationEmailMessage): Promise<void> {
    if (!this.isConfigured()) throw new Error('SMTP is not configured');

    const host = this.config.getOrThrow<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER', '');
    const password = this.config.get<string>('SMTP_PASSWORD', '');
    const origin = this.config.get<string>(
      'FRONTEND_ORIGIN',
      'http://localhost:8080',
    );
    const path =
      message.link.startsWith('/') && !message.link.startsWith('//')
        ? message.link
        : '/notifications';
    const notificationUrl = new URL(path, origin).toString();
    const transporter = nodemailer.createTransport({
      host,
      port: this.config.getOrThrow<number>('SMTP_PORT'),
      secure: this.config.getOrThrow<boolean>('SMTP_SECURE'),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      ...(user ? { auth: { user, pass: password } } : {}),
    });
    const title = this.escapeHtml(message.title);
    const body = this.escapeHtml(message.message);
    const url = this.escapeHtml(notificationUrl);

    try {
      await transporter.sendMail({
        from: this.config.getOrThrow<string>('EMAIL_FROM'),
        to: message.recipientEmail,
        subject: message.title,
        text: message.message + '\n\nXem chi tiết: ' + notificationUrl,
        html: [
          '<div style="font-family:Arial,sans-serif;color:#172b4d;max-width:600px;margin:auto">',
          '<h2 style="color:#1e3a5f">' + title + '</h2>',
          '<p style="line-height:1.6">' + body + '</p>',
          '<p><a href="' + url + '" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Xem chi tiết</a></p>',
          '<p style="color:#64748b;font-size:12px">Hành Trình Việt · Email tự động, vui lòng không trả lời.</p>',
          '</div>',
        ].join(''),
      });
    } finally {
      transporter.close();
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
