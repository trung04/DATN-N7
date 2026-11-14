import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import { ConfirmSettlementRequest } from '../dtos/requests/confirm-settlement.request';
import { CreateSettlementBatchRequest } from '../dtos/requests/create-settlement-batch.request';
import { SettlementFailureRequest } from '../dtos/requests/settlement-failure.request';
import { SettlementBatchWithItems } from '../interfaces/settlement.repository.interface';
import { SettlementsService } from '../services/settlements.service';

@ApiTags('Settlements')
@Roles(UserRole.ADMIN)
@Controller({ path: 'settlements', version: '1' })
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  async findPage(
    @Query('hotelId') hotelId?: string,
    @Query('status') status?: string,
  ) {
    const batches = await this.settlementsService.findPage({ hotelId, status });
    return batches.map(settlementBatchResponse);
  }

  @Get(':id')
  async findById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return settlementBatchResponse(await this.settlementsService.findById(id));
  }

  @Post()
  async create(@Body() input: CreateSettlementBatchRequest, @CurrentUser() user: UserEntity) {
    return settlementBatchResponse(await this.settlementsService.create(input, user.id));
  }

  @Post(':id/approve')
  async approve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: UserEntity,
  ) {
    return settlementBatchResponse(await this.settlementsService.approve(id, user.id));
  }

  @Post(':id/start')
  async start(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: UserEntity,
  ) {
    return settlementBatchResponse(await this.settlementsService.start(id, user.id));
  }

  @Post(':id/confirm')
  async confirm(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ConfirmSettlementRequest,
    @CurrentUser() user: UserEntity,
  ) {
    return settlementBatchResponse(await this.settlementsService.confirm(id, input.transferReference, user.id));
  }

  @Post(':id/fail')
  async fail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: SettlementFailureRequest,
    @CurrentUser() user: UserEntity,
  ) {
    return settlementBatchResponse(await this.settlementsService.fail(id, input.reason, user.id));
  }
}

export function settlementBatchResponse(batch: SettlementBatchWithItems) {
  return {
    ...batch,
    items: batch.items.map((item) => ({
      ...item,
      grossAmount: Number(item.grossAmount),
      commissionRateSnapshot: Number(item.commissionRateSnapshot),
      commissionAmount: Number(item.commissionAmount),
      netAmount: Number(item.netAmount),
    })),
  };
}
