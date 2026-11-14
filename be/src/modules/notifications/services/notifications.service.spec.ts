import type { NotificationEntity } from '../entities/notification.entity';
import type { NotificationRepository } from '../interfaces/notification.repository.interface';
import { NotificationNotFoundException } from '../exceptions/notification.exceptions';
import { NotificationsService } from './notifications.service';

const userId = '11111111-1111-4111-8111-111111111111';
const notificationId = '22222222-2222-4222-8222-222222222222';

describe('NotificationsService', () => {
  let repository: jest.Mocked<NotificationRepository>;
  let service: NotificationsService;

  beforeEach(() => {
    repository = {
      createOnce: jest.fn(),
      findPageForUser: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };
    service = new NotificationsService(repository);
  });

  it('creates a notification through the idempotent repository operation', async () => {
    const input = {
      userId,
      type: 'BOOKING_CONFIRMED',
      title: 'Booking confirmed',
      message: 'Your booking is confirmed.',
      link: `/bookings/${notificationId}`,
      eventKey: `booking:${notificationId}:confirmed`,
    } as Omit<NotificationEntity, 'id' | 'createdAt' | 'readAt'>;

    await service.createOnce(input);

    expect(repository.createOnce).toHaveBeenCalledWith(input);
  });

  it('returns page data with unread count for the requested user', async () => {
    const items = [
      { id: notificationId, userId, readAt: null } as NotificationEntity,
    ];
    repository.findPageForUser.mockResolvedValue({
      items,
      total: 1,
      unreadCount: 1,
    });

    await expect(service.findPageForUser(userId, 2, 10)).resolves.toEqual({
      data: items,
      meta: { page: 2, limit: 10, total: 1, unreadCount: 1 },
    });
    expect(repository.findPageForUser).toHaveBeenCalledWith(userId, 2, 10);
  });

  it('marks a notification read only within the requesting user scope', async () => {
    const notification = {
      id: notificationId,
      userId,
      readAt: new Date(),
    } as NotificationEntity;
    repository.markRead.mockResolvedValue(notification);

    await expect(service.markRead(userId, notificationId)).resolves.toBe(
      notification,
    );
    expect(repository.markRead).toHaveBeenCalledWith(userId, notificationId);
  });

  it('returns not found when the notification does not belong to the user', async () => {
    repository.markRead.mockResolvedValue(null);

    await expect(
      service.markRead(userId, notificationId),
    ).rejects.toBeInstanceOf(NotificationNotFoundException);
    expect(repository.markRead).toHaveBeenCalledWith(userId, notificationId);
  });

  it('marks all unread notifications for the requesting user', async () => {
    repository.markAllRead.mockResolvedValue(3);

    await expect(service.markAllRead(userId)).resolves.toBe(3);
    expect(repository.markAllRead).toHaveBeenCalledWith(userId);
  });
});
