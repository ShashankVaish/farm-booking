export interface SendSmsInput {
  phone: string;
  message: string;
}

export interface SmsProvider {
  readonly name: string;
  send(input: SendSmsInput): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
