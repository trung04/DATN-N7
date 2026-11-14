import { BadRequestException, Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../authorization/decorators/public.decorator';
import { SEPAY_V2_CLIENT } from '../interfaces/sepay-v2.interface';
import type { SePayV2Client, SePayWebhookPayload } from '../interfaces/sepay-v2.interface';
import { Inject } from '@nestjs/common';
import { BookingsService } from '../services/bookings.service';

@ApiTags('Payments')
@Public()
@Controller({ path: 'payments/sepay', version: '1' })
export class SePayCallbacksController {
  constructor(
    private readonly bookingsService: BookingsService,
    @Inject(SEPAY_V2_CLIENT) private readonly sepay: SePayV2Client,
  ) {}

  @Post(['webhook', 'ipn'])
  @ApiOperation({ summary: 'Receive SePay Sandbox v2 bank transfer webhook' })
  async webhook(
    @Body() payload: SePayWebhookPayload,
    @Req() request: RawBodyRequest<Request>,
    @Headers('authorization') authorization?: string,
    @Headers('x-secret-key') secretKey?: string,
    @Headers('x-sepay-signature') signature?: string,
    @Headers('x-sepay-timestamp') timestamp?: string,
  ): Promise<{ success: true }> {
    const authenticated = this.sepay.verifyWebhook({
      authorization,
      secretKey,
      signature,
      timestamp,
      rawBody: request.rawBody ?? Buffer.from(JSON.stringify(payload)),
    });
    if (!authenticated) throw new UnauthorizedException();
    const handled = await this.bookingsService.handleSePayV2Webhook(payload);
    if (!handled) throw new BadRequestException('SePay payment could not be matched to an active booking.');
    return { success: true };
  }
}
