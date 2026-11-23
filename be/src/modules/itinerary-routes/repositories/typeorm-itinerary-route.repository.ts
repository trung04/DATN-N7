import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ItineraryRouteEntity,
  ItineraryRouteStatus,
} from '../entities/itinerary-route.entity';
import type {
  CreateItineraryRouteData,
  ItineraryRouteRepository,
} from '../interfaces/itinerary-route.repository.interface';

@Injectable()
export class TypeOrmItineraryRouteRepository implements ItineraryRouteRepository {
  constructor(
    @InjectRepository(ItineraryRouteEntity)
    private readonly repository: Repository<ItineraryRouteEntity>,
  ) {}

  findCurrent(
    itineraryId: string,
    routeDate: string,
    profile: ItineraryRouteEntity['profile'],
  ): Promise<ItineraryRouteEntity | null> {
    return this.repository.findOne({
      where: {
        itineraryId,
        routeDate,
        profile,
        status: ItineraryRouteStatus.CURRENT,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async replaceCurrent(
    data: CreateItineraryRouteData,
  ): Promise<ItineraryRouteEntity> {
    return this.repository.manager.transaction(async (manager) => {
      const lockKey = `${data.itineraryId}:${data.routeDate}:${data.profile}`;
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        lockKey,
      ]);
      await manager
        .getRepository(ItineraryRouteEntity)
        .createQueryBuilder()
        .update()
        .set({ status: ItineraryRouteStatus.SUPERSEDED })
        .where('itinerary_id = :itineraryId', {
          itineraryId: data.itineraryId,
        })
        .andWhere('route_date = :routeDate', { routeDate: data.routeDate })
        .andWhere('profile = :profile', { profile: data.profile })
        .andWhere('status = :status', {
          status: ItineraryRouteStatus.CURRENT,
        })
        .execute();

      const repository = manager.getRepository(ItineraryRouteEntity);
      return repository.save(
        repository.create({
          ...data,
          provider: 'MAPBOX',
          status: ItineraryRouteStatus.CURRENT,
        }),
      );
    });
  }

  async markStale(route: ItineraryRouteEntity): Promise<void> {
    await this.repository.update(
      { id: route.id, status: ItineraryRouteStatus.CURRENT },
      { status: ItineraryRouteStatus.STALE },
    );
  }

  async delete(route: ItineraryRouteEntity): Promise<void> {
    await this.repository.delete(route.id);
  }

  async purgeExpired(now: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('expires_at <= :now', { now })
      .execute();
    return result.affected ?? 0;
  }
}
