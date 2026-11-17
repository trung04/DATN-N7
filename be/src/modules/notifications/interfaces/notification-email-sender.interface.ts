export const NOTIFICATION_EMAIL_SENDER = Symbol('NOTIFICATION_EMAIL_SENDER');

export interface NotificationEmailMessage {
  recipientEmail: string;
  title: string;
  message: string;
  link: string;
}

export interface NotificationEmailSender {
  isConfigured(): boolean;
  send(message: NotificationEmailMessage): Promise<void>;
}
