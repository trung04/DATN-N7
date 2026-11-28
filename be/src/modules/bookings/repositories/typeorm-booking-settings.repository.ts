import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BookingSettingsEntity } from '../entities/booking-settings.entity';
import type { BookingSettings, BookingSettingsRepository } from '../interfaces/booking-settings.repository.interface';

const SETTINGS_ID = 1;

@Injectable()
export class TypeOrmBookingSettingsRepository implements BookingSettingsRepository {
  constructor(
    @InjectRepository(BookingSettingsEntity)
    private readonly settings: Repository<BookingSettingsEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async find(): Promise<BookingSettings | null> {
    const row = await this.settings.findOneBy({ id: SETTINGS_ID });
    return row && this.toSettings(row);
  }

  save(commissionRate: number, adminId: string): Promise<BookingSettings> {
    return this.dataSource.transaction(async manager => {
      const repository = manager.getRepository(BookingSettingsEntity);
      await repository.upsert({
        id: SETTINGS_ID,
        commissionRate: commissionRate.toFixed(2),
        updatedBy: adminId,
      }, ['id']);
      return this.toSettings(await repository.findOneByOrFail({ id: SETTINGS_ID }));
    });
  }

  private toSettings(row: BookingSettingsEntity): BookingSettings {
    return { commissionRate: Number(row.commissionRate), updatedAt: row.updatedAt };
  }
}
