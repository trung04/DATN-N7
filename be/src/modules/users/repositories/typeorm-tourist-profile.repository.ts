import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TouristEntity } from '../entities/tourist.entity';
import type { TouristProfileRepository } from '../interfaces/tourist-profile.repository.interface';

@Injectable()
export class TypeOrmTouristProfileRepository implements TouristProfileRepository {
  constructor(
    @InjectRepository(TouristEntity)
    private readonly tourists: Repository<TouristEntity>,
  ) {}

  async findBioByUserId(userId: string): Promise<string | null> {
    return (await this.tourists.findOneBy({ userId }))?.bio ?? null;
  }

  async saveBio(userId: string, bio: string | null): Promise<string | null> {
    const existing = await this.tourists.findOne({
      where: { userId },
      withDeleted: true,
    });
    if (existing?.deletedAt) {
      await this.tourists.restore({ userId });
      existing.deletedAt = null;
    }
    const tourist = existing ?? this.tourists.create({ userId, bio: null });
    tourist.bio = bio;
    return (await this.tourists.save(tourist)).bio;
  }
}
