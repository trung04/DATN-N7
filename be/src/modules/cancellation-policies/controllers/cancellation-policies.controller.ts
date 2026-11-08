import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  ApiCreateOperation,
  ApiDeleteOperation,
  ApiDetailOperation,
  ApiListOperation,
  ApiUpdateOperation,
} from '../../../common/openapi/api-crud.decorator';
import { CreateCancellationPolicyRequest } from '../dtos/requests/create-cancellation-policy.request';
import { ListCancellationPoliciesRequest } from '../dtos/requests/list-cancellation-policies.request';
import { UpdateCancellationPolicyRequest } from '../dtos/requests/update-cancellation-policy.request';
import {
  CancellationPolicyListResponse,
  CancellationPolicyResponse,
} from '../dtos/responses/cancellation-policy.response';
import { CancellationPolicyMapper } from '../mappers/cancellation-policy.mapper';
import { CancellationPoliciesService } from '../services/cancellation-policies.service';

@ApiTags('Cancellation Policies')
@Controller({ path: 'cancellation-policies', version: '1' })
export class CancellationPoliciesController {
  constructor(
    private readonly cancellationPoliciesService: CancellationPoliciesService,
  ) {}

  @Post()
  @ApiCreateOperation(
    'Create a cancellation policy',
    CancellationPolicyResponse,
  )
  async create(
    @Body() input: CreateCancellationPolicyRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CancellationPolicyResponse> {
    const policy = await this.cancellationPoliciesService.create(input);
    response.setHeader(
      'Location',
      `/api/v1/cancellation-policies/${policy.id}`,
    );
    return CancellationPolicyMapper.toResponse(policy);
  }

  @Get()
  @ApiListOperation(
    'List cancellation policies',
    CancellationPolicyListResponse,
  )
  async findPage(
    @Query() query: ListCancellationPoliciesRequest,
  ): Promise<CancellationPolicyListResponse> {
    const page = await this.cancellationPoliciesService.findPage(query);
    return CancellationPolicyMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get(':policyId')
  @ApiDetailOperation(
    'Get a cancellation policy',
    CancellationPolicyResponse,
    'policyId',
  )
  async findById(
    @Param('policyId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<CancellationPolicyResponse> {
    return CancellationPolicyMapper.toResponse(
      await this.cancellationPoliciesService.findById(id),
    );
  }

  @Patch(':policyId')
  @ApiUpdateOperation(
    'Update a cancellation policy',
    CancellationPolicyResponse,
    'policyId',
  )
  async update(
    @Param('policyId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateCancellationPolicyRequest,
  ): Promise<CancellationPolicyResponse> {
    return CancellationPolicyMapper.toResponse(
      await this.cancellationPoliciesService.update(id, input),
    );
  }

  @Delete(':policyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteOperation('Delete a cancellation policy', 'policyId')
  async delete(
    @Param('policyId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.cancellationPoliciesService.delete(id);
  }
}
