import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HotelDocumentEntity } from '../entities/hotel-document.entity';
import { HotelEntity } from '../entities/hotel.entity';
import type { HotelDocumentRepository, HotelDocumentTransaction } from '../interfaces/hotel-document.repository.interface';

@Injectable()
export class TypeOrmHotelDocumentRepository implements HotelDocumentRepository {
  constructor(private readonly dataSource: DataSource) {}

  find(hotelId: string, id: string) {
    return this.dataSource.getRepository(HotelDocumentEntity).findOneBy({ hotelId, id });
  }

  transaction<T>(hotelId: string, work: (transaction: HotelDocumentTransaction) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async manager => {
      const hotel = await manager.getRepository(HotelEntity).findOne({ where: { id: hotelId }, lock: { mode: 'pessimistic_write' } });
      const documents = manager.getRepository(HotelDocumentEntity);
      return work({
        hotel,
        find: id => documents.findOneBy({ id, hotelId }),
        save: document => documents.save(document),
        delete: async document => { await documents.remove(document); },
      });
    });
  }
}
