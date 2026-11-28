import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../authorization/decorators/public.decorator';
import { BookingsService } from '../services/bookings.service';

@ApiTags('Payments')
@Public()
@Controller({ path: 'payments/payos', version: '1' })
export class PayosWebhookController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive signed payOS payment webhooks' })
  async webhook(@Body() body: unknown): Promise<{ success: true }> {
    await this.bookings.handlePayosWebhook(body);
    return { success: true };
  }
}
