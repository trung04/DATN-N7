import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  SePayBankHubDebit,
  SePayBankHubPayoutClient,
} from '../../interfaces/sepay-bankhub-payout.interface';

const BANK_HUB_SANDBOX_API = 'https://bankhub-api-sandbox.sepay.vn/v1';

interface BankHubTokenResponse {
  access_token?: string;
  ttl?: number;
}

interface BankHubTransaction {
  transaction_id?: string;
  reference_number?: string;
  transfer_type?: string;
  amount?: number | string;
  transaction_content?: string;
}

interface BankHubTransactionListResponse {
  data?: BankHubTransaction[];
}

interface BankHubCreateResponse {
  data?: {
    transaction_id?: string;
    reference_number?: string;
    amount?: number | string;
    transfer_type?: string;
  };
}

export class SePayBankHubPayoutError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly mayHaveSucceeded: boolean,
  ) {
    super(message);
    this.name = 'SePayBankHubPayoutError';
  }
}

@Injectable()
export class SePayBankHubPayoutClientImpl
  implements SePayBankHubPayoutClient
{
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;
  private tokenRequest: Promise<string> | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('SEPAY_BANKHUB_CLIENT_ID') &&
        this.config.get<string>('SEPAY_BANKHUB_CLIENT_SECRET') &&
        this.config.get<string>('SEPAY_BANKHUB_BANK_ACCOUNT_XID'),
    );
  }

  async findDebitByMemo(memo: string): Promise<SePayBankHubDebit | null> {
    const url = new URL(`${BANK_HUB_SANDBOX_API}/transaction`);
    url.searchParams.set('bank_account_xid', this.bankAccountXid());
    url.searchParams.set('transfer_type', 'debit');
    url.searchParams.set('q', memo);
    url.searchParams.set('page', '1');
    url.searchParams.set('per_page', '50');
    const response = await this.request<BankHubTransactionListResponse>(
      url.toString(),
      { method: 'GET' },
    );
    const matches = (response.data ?? [])
      .filter(
        (item) =>
          item.transfer_type === 'debit' &&
          item.transaction_content === memo,
      )
      .map((item) => this.toDebit(item))
      .filter((item): item is SePayBankHubDebit => item !== null);
    if (matches.length > 1) {
      throw new SePayBankHubPayoutError(
        'More than one sandbox debit matches this settlement memo.',
        null,
        true,
      );
    }
    return matches[0] ?? null;
  }

  async simulateDebit(input: {
    amount: number;
    transactionContent: string;
  }): Promise<SePayBankHubDebit> {
    const accountXid = this.bankAccountXid();
    const response = await this.request<BankHubCreateResponse>(
      `${BANK_HUB_SANDBOX_API}/transaction/create`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_account_xid: accountXid,
          transfer_type: 'debit',
          amount: input.amount,
          transaction_content: input.transactionContent,
        }),
      },
    );
    const transaction = response.data;
    const result = transaction
      ? this.toDebit({
          ...transaction,
          transfer_type: transaction.transfer_type ?? 'debit',
          transaction_content: input.transactionContent,
        })
      : null;
    if (!result || result.amount !== input.amount) {
      throw new SePayBankHubPayoutError(
        'SePay sandbox returned an incomplete debit transaction.',
        null,
        true,
      );
    }
    return result;
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    if (!this.isConfigured()) {
      throw new SePayBankHubPayoutError(
        'SePay Bank Hub Sandbox payout credentials are not configured.',
        null,
        false,
      );
    }
    let token = await this.getToken();
    let response = await this.fetch(url, init, token);
    if (response.status === 401) {
      this.cachedToken = null;
      this.tokenExpiresAt = 0;
      token = await this.getToken();
      response = await this.fetch(url, init, token);
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new SePayBankHubPayoutError(
        `SePay Bank Hub Sandbox rejected the request (HTTP ${response.status}).`,
        response.status,
        response.status >= 500 || response.status === 408 || response.status === 429,
      );
    }
    if (!payload || typeof payload !== 'object') {
      throw new SePayBankHubPayoutError(
        'SePay Bank Hub Sandbox returned an invalid response.',
        response.status,
        true,
      );
    }
    return payload as T;
  }

  private async fetch(
    url: string,
    init: RequestInit,
    token: string,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...Object.fromEntries(new Headers(init.headers).entries()),
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
    } catch {
      throw new SePayBankHubPayoutError(
        'Could not confirm the result from SePay Bank Hub Sandbox. Reconcile before retrying.',
        null,
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.cachedToken;
    }
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = this.requestToken();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = null;
    }
  }

  private async requestToken(): Promise<string> {
    const clientId = this.config.getOrThrow<string>(
      'SEPAY_BANKHUB_CLIENT_ID',
    );
    const clientSecret = this.config.getOrThrow<string>(
      'SEPAY_BANKHUB_CLIENT_SECRET',
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(`${BANK_HUB_SANDBOX_API}/token`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString(
              'base64',
            ),
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });
    } catch {
      throw new SePayBankHubPayoutError(
        'Could not obtain an access token from SePay Bank Hub Sandbox.',
        null,
        false,
      );
    } finally {
      clearTimeout(timeout);
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== 'object') {
      throw new SePayBankHubPayoutError(
        `SePay Bank Hub Sandbox token request failed (HTTP ${response.status}).`,
        response.status,
        false,
      );
    }
    const tokenResponse = payload as BankHubTokenResponse;
    if (
      typeof tokenResponse.access_token !== 'string' ||
      typeof tokenResponse.ttl !== 'number' ||
      tokenResponse.ttl <= 0
    ) {
      throw new SePayBankHubPayoutError(
        'SePay Bank Hub Sandbox returned an invalid access token response.',
        response.status,
        false,
      );
    }
    this.cachedToken = tokenResponse.access_token;
    this.tokenExpiresAt = Date.now() + tokenResponse.ttl * 1000;
    return this.cachedToken;
  }

  private bankAccountXid(): string {
    return this.config.getOrThrow<string>(
      'SEPAY_BANKHUB_BANK_ACCOUNT_XID',
    );
  }

  private toDebit(
    transaction: BankHubTransaction,
  ): SePayBankHubDebit | null {
    const amount = Number(transaction.amount);
    if (
      typeof transaction.transaction_id !== 'string' ||
      typeof transaction.reference_number !== 'string' ||
      !Number.isInteger(amount) ||
      typeof transaction.transaction_content !== 'string'
    ) {
      return null;
    }
    return {
      transactionId: transaction.transaction_id,
      referenceNumber: transaction.reference_number,
      amount,
      transactionContent: transaction.transaction_content,
    };
  }
}
