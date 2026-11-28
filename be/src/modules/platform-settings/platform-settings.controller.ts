import { Body, Controller, Get, Header, NotFoundException, Param, Put } from '@nestjs/common';
import { IsInt, IsObject, Min } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../authorization/decorators/public.decorator';
import { Roles } from '../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { isPlatformSection } from './platform-settings.catalog';
import { PlatformSettingsService } from './platform-settings.service';

export class UpdatePlatformSettingsRequest {
  @IsInt()
  @Min(0)
  revision: number;

  @IsObject()
  values: Record<string, unknown>;
}

@Roles(UserRole.ADMIN)
@Controller({ path: 'admin/settings/integrations', version: '1' })
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list() { return this.settings.list(); }

  @Put(':section')
  @Header('Cache-Control', 'no-store')
  update(@Param('section') section: string, @Body() input: UpdatePlatformSettingsRequest, @CurrentUser() user: UserEntity) {
    if (!isPlatformSection(section)) throw new NotFoundException('Không tìm thấy nhóm cấu hình.');
    return this.settings.save(section, input.revision, input.values, user);
  }
}

@Public()
@Controller({ path: 'public-settings', version: '1' })
export class PublicSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('map')
  @Header('Cache-Control', 'no-store')
  map() { return { mapboxToken: this.settings.publicMapToken() }; }
}
