import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import type { Request, Response } from 'express';
import {
  ApiCreateOperation,
  ApiDetailOperation,
  ApiListOperation,
  ApiUpdateOperation,
} from '../../../common/openapi/api-crud.decorator';
import { CreateVnpayPaymentRequest } from '../dtos/requests/create-vnpay-payment.request';
import { CreateBookingRequest } from '../dtos/requests/create-booking.request';
import { ListBookingsRequest } from '../dtos/requests/list-bookings.request';
import { RefundBookingRequest } from '../dtos/requests/refund-booking.request';
import { SettleBookingRequest } from '../dtos/requests/settle-booking.request';
import { UpdateBookingRequest } from '../dtos/requests/update-booking.request';
import {
  BookingListResponse,
  BookingResponse,
} from '../dtos/responses/booking.response';
import { VnpayPaymentResponse } from '../dtos/responses/vnpay-payment.response';
import { BookingMapper } from '../mappers/booking.mapper';
import { BookingsService } from '../services/bookings.service';

const idempotencyKeyPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('Bookings')
@Roles(UserRole.TOURIST, UserRole.HOTEL_OWNER, UserRole.ADMIN)
@Controller({ path: 'bookings', version: '1' })
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiCreateOperation('Create a booking', BookingResponse)
  @ApiHeader({
    name: 'Idempotency-Key',
    description:
      'A unique UUID v4 for this booking attempt. Reuse it only when retrying the same request body.',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  async create(
    @CurrentUser() user: UserEntity,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateBookingRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BookingResponse> {
    const validatedKey = (await idempotencyKeyPipe.transform(
      idempotencyKey ?? '',
      { type: 'custom' },
    )) as string;
    const result = await this.bookingsService.create(
      user.id,
      input,
      validatedKey,
    );
    response.setHeader('Location', `/api/v1/bookings/${result.booking.id}`);
    response.setHeader('Idempotency-Replayed', String(result.replayed));
    return BookingMapper.toResponse(result.booking);
  }

  @Get()
  @ApiListOperation('List bookings', BookingListResponse)
  async findPage(
    @CurrentUser() user: UserEntity,
    @Query() query: ListBookingsRequest,
  ): Promise<BookingListResponse> {
    const page = await this.bookingsService.findPageForActor(query, user);
    return BookingMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get(':bookingId')
  @ApiDetailOperation('Get a booking', BookingResponse, 'bookingId')
  async findById(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<BookingResponse> {
    return BookingMapper.toResponse(
      await this.bookingsService.findByIdForActor(id, user),
    );
  }

  @Patch(':bookingId')
  @ApiUpdateOperation('Update booking details', BookingResponse, 'bookingId')
  async update(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateBookingRequest,
  ): Promise<BookingResponse> {
    return BookingMapper.toResponse(
      await this.bookingsService.updateForActor(id, input, user),
    );
  }

  @Post(':bookingId/cancel')
  @ApiUpdateOperation('Cancel a booking using the applicable hotel policy', BookingResponse, 'bookingId')
  async cancel(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<BookingResponse> {
    return BookingMapper.toResponse(await this.bookingsService.cancelForActor(id, user));
  }

  @Put(':bookingId/complete')
  @Roles(UserRole.HOTEL_OWNER)
  @ApiUpdateOperation('Mark a managed hotel booking as completed', BookingResponse, 'bookingId')
  async completeForHotelOwner(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<BookingResponse> {
    return BookingMapper.toResponse(
      await this.bookingsService.completeForHotelOwner(id, user),
    );
  }

  @Put(':bookingId/payment/vnpay')
  @ApiUpdateOperation(
    'Create a VNPAY Sandbox payment URL',
    VnpayPaymentResponse,
    'bookingId',
  )
  async createVnpayPayment(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: CreateVnpayPaymentRequest,
    @Req() request: Request,
  ): Promise<VnpayPaymentResponse> {
    const result = await this.bookingsService.createVnpayPaymentForActor(
      id,
      input,
      this.customerIp(request),
      user,
    );
    return {
      bookingId: result.booking.id,
      bookingCode: result.booking.bookingCode,
      paymentMethod: result.booking.paymentMethod,
      paymentStatus: result.booking.paymentStatus,
      paymentUrl: result.paymentUrl,
      expiresAt: result.booking.paymentExpiresAt!.toISOString(),
    };
  }

  @Put(':bookingId/settlement')
  @Roles(UserRole.ADMIN)
  @ApiUpdateOperation('Settle a paid booking', BookingResponse, 'bookingId')
  async settle(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: SettleBookingRequest,
  ): Promise<BookingResponse> {
    return BookingMapper.toResponse(
      await this.bookingsService.settle(id, input),
    );
  }

  @Put(':bookingId/refund')
  @Roles(UserRole.ADMIN)
  @ApiUpdateOperation('Refund a paid booking', BookingResponse, 'bookingId')
  async refund(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: RefundBookingRequest,
    @Req() request: Request,
  ): Promise<BookingResponse> {
    return BookingMapper.toResponse(
      await this.bookingsService.refund(id, input, this.customerIp(request)),
    );
  }

  private customerIp(request: Request): string {
    const ip = request.ip ?? request.socket.remoteAddress ?? '127.0.0.1';
    return ip.replace(/^::ffff:/, '');
  }
}
