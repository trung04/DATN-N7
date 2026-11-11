import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelImageEntity } from '../entities/hotel-image.entity';
import type { HotelImageRepository } from '../interfaces/hotel-image.repository.interface';

@Injectable()
export class TypeOrmHotelImageRepository implements HotelImageRepository {
  constructor(
    @InjectRepository(HotelImageEntity)
    private readonly repository: Repository<HotelImageEntity>,
  ) {}
  create(data: Omit<HotelImageEntity, 'hotel' | 'createdAt'>) {
    return this.repository.save(this.repository.create(data));
  }
  find(hotelId: string, id: string) {
    return this.repository.findOneBy({ hotelId, id });
  }
  async delete(hotelId: string, id: string): Promise<void> {
    await this.repository.delete({ hotelId, id });
  }
}
