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
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import {
  CreatePlaceTaxonomyRequest,
  UpdatePlaceTaxonomyRequest,
} from '../dtos/requests/place-taxonomy.request';
import { PlaceTaxonomyResponse } from '../dtos/responses/place-taxonomy.response';
import type { PlaceTaxonomyKind } from '../interfaces/place-taxonomy.repository.interface';
import { PlaceTaxonomiesService } from '../services/place-taxonomies.service';

abstract class TaxonomyControllerBase {
  protected abstract readonly kind: PlaceTaxonomyKind;
  protected abstract readonly resourcePath: string;

  constructor(protected readonly service: PlaceTaxonomiesService) {}

  @Get()
  @ApiOkResponse({ type: PlaceTaxonomyResponse, isArray: true })
  list(): Promise<PlaceTaxonomyResponse[]> {
    return this.service.list(this.kind);
  }

  @Post()
  async create(
    @Body() input: CreatePlaceTaxonomyRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlaceTaxonomyResponse> {
    const created = await this.service.create(this.kind, input);
    response.status(HttpStatus.CREATED);
    response.setHeader('Location', `/api/v1/${this.resourcePath}/${created.id}`);
    return created;
  }

  @Patch(':taxonomyId')
  update(
    @Param('taxonomyId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdatePlaceTaxonomyRequest,
  ): Promise<PlaceTaxonomyResponse> {
    return this.service.update(this.kind, id, input);
  }

  @Delete(':taxonomyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('taxonomyId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.service.delete(this.kind, id);
  }
}

@ApiTags('Place categories')
@Roles(UserRole.ADMIN)
@Controller({ path: 'place-categories', version: '1' })
export class PlaceCategoriesController extends TaxonomyControllerBase {
  protected readonly kind = 'category' as const;
  protected readonly resourcePath = 'place-categories';

  constructor(service: PlaceTaxonomiesService) { super(service); }
}

@ApiTags('Place topics')
@Roles(UserRole.ADMIN)
@Controller({ path: 'topics', version: '1' })
export class TopicsController extends TaxonomyControllerBase {
  protected readonly kind = 'topic' as const;
  protected readonly resourcePath = 'topics';

  constructor(service: PlaceTaxonomiesService) { super(service); }
}
