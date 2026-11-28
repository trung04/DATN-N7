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
  Res,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { Public } from '../../authorization/decorators/public.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import type { Response } from 'express';
import {
  ApiCreateOperation,
  ApiDetailOperation,
  ApiListOperation,
  ApiUpdateOperation,
} from '../../../common/openapi/api-crud.decorator';
import { CreateBookingRequest } from '../dtos/requests/create-booking.request';
import { SearchRoomAvailabilityRequest } from '../dtos/requests/search-room-availability.request';
import { ListBookingsRequest } from '../dtos/requests/list-bookings.request';
import { ConfirmManualRefundRequest, RefundBookingRequest } from '../dtos/requests/refund-booking.request';
import { UpdateBookingRequest } from '../dtos/requests/update-booking.request';
import {
  BookingListResponse,
  BookingResponse,
} from '../dtos/responses/booking.response';
import { PayosPaymentResponse } from '../dtos/responses/payos-payment.response';
import { BookingMapper } from '../mappers/booking.mapper';
import { BookingsService } from '../services/bookings.service';

const idempotencyKeyPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('Bookings')
@Roles(UserRole.TOURIST, UserRole.HOTEL_OWNER, UserRole.ADMIN)
@Controller({ path: 'bookings', version: '1' })
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('availability')
  @Public()
  async searchRoomAvailability(
    @Query() query: SearchRoomAvailabilityRequest,
  ): Promise<{
    hotelId: string | null;
    checkInDate: string;
    checkOutDate: string;
    availableRoomIds: string[];
  }> {
    return this.bookingsService.searchRoomAvailability(query);
  }

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

  @Put(':bookingId/payment/payos')
  @ApiUpdateOperation('Create a payOS checkout URL', PayosPaymentResponse, 'bookingId')
  async createPayosPayment(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PayosPaymentResponse> {
    return this.bookingsService.createPayosPaymentForActor(id, user);
  }

  @Put(':bookingId/payment/payos/refresh')
  @ApiUpdateOperation('Reconcile a payOS payment', BookingResponse, 'bookingId')
  async refreshPayosPayment(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<BookingResponse> {
    return BookingMapper.toResponse(await this.bookingsService.refreshPayosPaymentForActor(id, user));
  }

  @Put(':bookingId/refund')
  @Roles(UserRole.ADMIN)
  @ApiUpdateOperation('Submit a payOS payout refund', BookingResponse, 'bookingId')
  async refund(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: RefundBookingRequest,
  ): Promise<BookingResponse> {
    return BookingMapper.toResponse(
      await this.bookingsService.refund(id, input, user),
    );
  }

  @Put(':bookingId/refund/refresh')
  @Roles(UserRole.ADMIN)
  @ApiUpdateOperation('Reconcile a payOS payout refund', BookingResponse, 'bookingId')
  async refreshPayosRefund(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<BookingResponse> {
    return BookingMapper.toResponse(await this.bookingsService.refreshPayosRefund(id, user));
  }

  @Put(':bookingId/refund/manual-completion')
  @Roles(UserRole.ADMIN)
  @ApiUpdateOperation('Record a completed historical refund', BookingResponse, 'bookingId')
  async confirmManualRefund(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ConfirmManualRefundRequest,
  ): Promise<BookingResponse> {
    return BookingMapper.toResponse(
      await this.bookingsService.confirmManualRefund(id, input, user),
    );
  }
}
