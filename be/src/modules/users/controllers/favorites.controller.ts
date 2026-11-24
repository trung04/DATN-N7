import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../entities/user.entity';
import { ToggleFavoriteRequest } from '../dtos/requests/toggle-favorite.request';
import { FavoriteResponse, FavoriteToggleResponse } from '../dtos/responses/favorite.response';
import { FavoritesService } from '../services/favorites.service';

@ApiTags('Favorites')
@Roles(UserRole.TOURIST)
@Controller({ path: 'users/me/favorites', version: '1' })
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated tourist favorites' })
  @ApiOkResponse({ type: FavoriteResponse, isArray: true })
  findMine(@CurrentUser() user: UserEntity): Promise<FavoriteResponse[]> {
    return this.service.findMine(user.id);
  }

  @Post('toggle')
  @ApiOperation({ summary: 'Save or remove a favorite place or hotel' })
  @ApiOkResponse({ type: FavoriteToggleResponse })
  async toggle(
    @CurrentUser() user: UserEntity,
    @Body() input: ToggleFavoriteRequest,
  ): Promise<FavoriteToggleResponse> {
    return { saved: await this.service.toggle(user.id, input.targetType, input.targetId) };
  }
}
