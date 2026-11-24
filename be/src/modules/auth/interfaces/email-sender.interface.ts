export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailSender {
  isConfigured(): boolean;
  sendOtp(email: string, purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET', otp: string): Promise<void>;
}
