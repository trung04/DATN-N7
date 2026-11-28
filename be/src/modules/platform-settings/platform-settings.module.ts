import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSettingsController, PublicSettingsController } from './platform-settings.controller';
import { PlatformSettingsEntity, PlatformSettingsRepository } from './platform-settings.repository';
import { PlatformSettingsService } from './platform-settings.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PlatformSettingsEntity])],
  controllers: [PlatformSettingsController, PublicSettingsController],
  providers: [PlatformSettingsRepository, PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
