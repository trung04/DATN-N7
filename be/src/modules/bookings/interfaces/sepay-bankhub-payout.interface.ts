export const SEPAY_BANKHUB_PAYOUT = Symbol('SEPAY_BANKHUB_PAYOUT');

export interface SePayBankHubDebit {
  transactionId: string;
  referenceNumber: string;
  amount: number;
  transactionContent: string;
}

export interface SePayBankHubPayoutClient {
  isConfigured(): boolean;
  findDebitByMemo(memo: string): Promise<SePayBankHubDebit | null>;
  simulateDebit(input: {
    amount: number;
    transactionContent: string;
  }): Promise<SePayBankHubDebit>;
}
