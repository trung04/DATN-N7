import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NotificationEntity } from '../entities/notification.entity';
import type {
  NotificationPage,
  NotificationRepository,
} from '../interfaces/notification.repository.interface';

@Injectable()
export class TypeOrmNotificationRepository implements NotificationRepository {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repository: Repository<NotificationEntity>,
  ) {}

  async createOnce(
    input: Omit<NotificationEntity, 'id' | 'createdAt' | 'readAt'>,
  ): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(NotificationEntity)
      .values(input)
      .orIgnore()
      .execute();
  }

  async findPageForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<NotificationPage> {
    const [items, total, unreadCount] = await Promise.all([
      this.repository.find({
        where: { userId },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.repository.count({ where: { userId } }),
      this.repository.count({ where: { userId, readAt: IsNull() } }),
    ]);
    return { items, total, unreadCount };
  }

  async markRead(userId: string, id: string): Promise<NotificationEntity | null> {
    await this.repository.update(
      { id, userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return this.repository.findOne({ where: { id, userId } });
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.repository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return result.affected ?? 0;
  }
}
