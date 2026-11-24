import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  VnpayIpnResponse,
  VnpayReturnResponse,
} from '../dtos/responses/vnpay-payment.response';
import { BookingsService } from '../services/bookings.service';

@ApiTags('Bookings')
@Controller({ path: 'payments/vnpay', version: '1' })
export class VnpayCallbacksController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('ipn')
  @ApiOperation({ summary: 'Receive the VNPAY Sandbox payment IPN' })
  @ApiOkResponse({ type: VnpayIpnResponse })
  ipn(@Query() query: Record<string, unknown>): Promise<VnpayIpnResponse> {
    return this.bookingsService.handleVnpayIpn(query);
  }

  @Get('return')
  @ApiOperation({ summary: 'Display the verified VNPAY return result' })
  @ApiOkResponse({ type: VnpayReturnResponse })
  result(
    @Query() query: Record<string, unknown>,
  ): Promise<VnpayReturnResponse> {
    return this.bookingsService.getVnpayReturn(query);
  }
}
