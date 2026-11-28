import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { UserRole } from '../../users/entities/user.entity';
import { BOOKING_SETTINGS_REPOSITORY } from '../interfaces/booking-settings.repository.interface';
import type { BookingSettings, BookingSettingsRepository } from '../interfaces/booking-settings.repository.interface';

@Injectable()
export class BookingSettingsService {
  constructor(
    @Inject(BOOKING_SETTINGS_REPOSITORY)
    private readonly repository: BookingSettingsRepository,
    private readonly config: ConfigService,
  ) {}

  async get(): Promise<BookingSettings> {
    return await this.repository.find() ?? {
      commissionRate: this.config.getOrThrow<number>('BOOKING_COMMISSION_RATE'),
      updatedAt: null,
    };
  }

  save(commissionRate: number, actor: AuthorizationActor): Promise<BookingSettings> {
    if (actor.role !== UserRole.ADMIN) throw new AuthorizationDeniedException();
    return this.repository.save(commissionRate, actor.id);
  }
}
