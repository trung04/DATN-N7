import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { BookingEntity } from '../entities/booking.entity';
import { BookingIdempotencyKeyEntity } from '../entities/booking-idempotency-key.entity';
import { BookingRoomEntity } from '../entities/booking-room.entity';
import {
  BookingCancellationPolicyReferenceException,
  BookingCodeConflictException,
  BookingTransactionConflictException,
  BookingRoomReferenceException,
  BookingRoomUnavailableException,
  IdempotencyKeyReusedException,
} from '../exceptions/booking.exceptions';
import type {
  BookingPage,
  BookingIdempotencyData,
  BookingRepository,
  CreatedBookingResult,
  CreateBookingData,
  CreateBookingRoomData,
  FindBookingsOptions,
} from '../interfaces/booking.repository.interface';

@Injectable()
export class TypeOrmBookingRepository implements BookingRepository {
  constructor(
    @InjectRepository(BookingEntity)
    private readonly repository: Repository<BookingEntity>,
    @InjectRepository(BookingIdempotencyKeyEntity)
    private readonly idempotencyRepository: Repository<BookingIdempotencyKeyEntity>,
  ) {}

  async findUnavailableRoomIds(
    hotelId: string | undefined,
    checkInDate: string,
    checkOutDate: string,
  ): Promise<string[]> {
    const conflicts = (await this.repository.manager.query(
      `
        SELECT DISTINCT br.room_id AS "roomId"
        FROM booking_rooms br
        INNER JOIN bookings b ON b.id = br.booking_id
        WHERE ($1::uuid IS NULL OR b.hotel_id = $1::uuid)
          AND (
            b.booking_status = 'CONFIRMED'
            OR (
              b.booking_status = 'PENDING'
              AND b.reservation_expires_at > now()
            )
          )
          AND b.check_in_date < $2::date
          AND b.check_out_date > $3::date
      `,
      [hotelId ?? null, checkOutDate, checkInDate],
    )) as Array<{ roomId: string }>;
    return conflicts.map(({ roomId }) => roomId);
  }

  async findById(id: string): Promise<BookingEntity | null> {
    const booking = await this.repository.findOne({
      where: { id },
      relations: { roomItems: true },
    });
    if (booking) this.sortRoomItems(booking);
    return booking;
  }

  findByCode(bookingCode: string): Promise<BookingEntity | null> {
    return this.repository.findOneBy({ bookingCode });
  }

  findBySePayOrderCode(orderCode: string): Promise<BookingEntity | null> {
    return this.repository.findOneBy({ sepayOrderCode: orderCode });
  }

  async findByIdempotencyKey(
    key: string,
    requestHash: string,
  ): Promise<BookingEntity | null> {
    const record = await this.idempotencyRepository.findOneBy({
      idempotencyKey: key,
    });
    if (!record || record.expiresAt <= new Date()) return null;
    if (record.requestHash !== requestHash) {
      throw new IdempotencyKeyReusedException();
    }
    return this.findById(record.bookingId);
  }

  async findPage(options: FindBookingsOptions): Promise<BookingPage> {
    const query = this.repository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.roomItems', 'roomItem');

    if (options.search) {
      const escapedSearch = options.search.replace(/[\\%_]/g, '\\$&');
      query.andWhere(
        `(booking.bookingCode ILIKE :search ESCAPE '\\'
          OR booking.guestName ILIKE :search ESCAPE '\\')`,
        { search: `%${escapedSearch}%` },
      );
    }
    if (options.hotelId) {
      query.andWhere('booking.hotelId = :hotelId', {
        hotelId: options.hotelId,
      });
    }
    if (options.touristId) {
      query.andWhere('booking.touristId = :touristId', {
        touristId: options.touristId,
      });
    }
    if (options.bookingStatus) {
      query.andWhere('booking.bookingStatus = :bookingStatus', {
        bookingStatus: options.bookingStatus,
      });
    }
    if (options.paymentStatus) {
      query.andWhere('booking.paymentStatus = :paymentStatus', {
        paymentStatus: options.paymentStatus,
      });
    }
    if (options.settlementStatus) {
      query.andWhere('booking.settlementStatus = :settlementStatus', {
        settlementStatus: options.settlementStatus,
      });
    }
    if (options.refundStatus) {
      query.andWhere('booking.refundStatus = :refundStatus', {
        refundStatus: options.refundStatus,
      });
    }
    if (options.createdFrom) {
      query.andWhere('booking.createdAt >= :createdFrom', {
        createdFrom: options.createdFrom,
      });
    }
    if (options.createdTo) {
      query.andWhere('booking.createdAt <= :createdTo', {
        createdTo: options.createdTo,
      });
    }

    const sortColumns: Record<FindBookingsOptions['sortBy'], string> = {
      createdAt: 'booking.createdAt',
      bookingCode: 'booking.bookingCode',
      totalAmount: 'booking.totalAmount',
      amount: 'booking.amount',
    };

    const [items, total] = await query
      .orderBy(sortColumns[options.sortBy], options.sortOrder)
      .addOrderBy('booking.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    for (const booking of items) this.sortRoomItems(booking);
    return { items, total };
  }

  async create(
    data: CreateBookingData,
    roomItems: CreateBookingRoomData[],
    idempotency: BookingIdempotencyData,
  ): Promise<CreatedBookingResult> {
    try {
      return await this.repository.manager.transaction(async (manager) => {
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [`booking-idempotency:${idempotency.key}`],
        );
        const idempotencyRepository = manager.getRepository(
          BookingIdempotencyKeyEntity,
        );
        const existing = await idempotencyRepository.findOneBy({
          idempotencyKey: idempotency.key,
        });
        if (existing && existing.expiresAt > new Date()) {
          if (existing.requestHash !== idempotency.requestHash) {
            throw new IdempotencyKeyReusedException();
          }
          const replayedBooking = await manager
            .getRepository(BookingEntity)
            .findOne({
              where: { id: existing.bookingId },
              relations: { roomItems: true },
            });
          if (!replayedBooking) throw new BookingTransactionConflictException();
          this.sortRoomItems(replayedBooking);
          return { booking: replayedBooking, replayed: true };
        }
        if (existing) await idempotencyRepository.remove(existing);

        const roomIds = roomItems.map((item) => item.roomId).sort();
        for (const roomId of roomIds) {
          await manager.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
            [roomId],
          );
        }
        const conflicts = (await manager.query(
          `
            SELECT br.room_id AS "roomId"
            FROM booking_rooms br
            INNER JOIN bookings b ON b.id = br.booking_id
            WHERE br.room_id = ANY($1::uuid[])
              AND (
                b.booking_status = 'CONFIRMED'
                OR (
                  b.booking_status = 'PENDING'
                  AND b.reservation_expires_at > now()
                )
              )
              AND b.check_in_date < $2::date
              AND b.check_out_date > $3::date
            LIMIT 1
          `,
          [roomIds, data.checkOutDate, data.checkInDate],
        )) as Array<{ roomId: string }>;
        if (conflicts.length > 0) {
          throw new BookingRoomUnavailableException(conflicts[0].roomId);
        }

        const bookingRepository = manager.getRepository(BookingEntity);
        const saved = await bookingRepository.save(
          bookingRepository.create(data),
        );
        const itemRepository = manager.getRepository(BookingRoomEntity);
        saved.roomItems = await itemRepository.save(
          roomItems.map((item) =>
            itemRepository.create({ ...item, bookingId: saved.id }),
          ),
        );
        await idempotencyRepository.save(
          idempotencyRepository.create({
            idempotencyKey: idempotency.key,
            requestHash: idempotency.requestHash,
            bookingId: saved.id,
            expiresAt: idempotency.expiresAt,
          }),
        );
        this.sortRoomItems(saved);
        return { booking: saved, replayed: false };
      });
    } catch (error) {
      this.rethrowPersistenceConflict(error);
    }
  }

  async save(booking: BookingEntity): Promise<BookingEntity> {
    try {
      return await this.repository.save(booking);
    } catch (error) {
      this.rethrowPersistenceConflict(error);
    }
  }

  async withLockedById<T>(
    id: string,
    operation: (booking: BookingEntity) => Promise<T> | T,
  ): Promise<T | null> {
    try {
      return await this.repository.manager.transaction(async (manager) => {
        const repository = manager.getRepository(BookingEntity);
        const booking = await repository
          .createQueryBuilder('booking')
          .setLock('pessimistic_write')
          .where('booking.id = :id', { id })
          .getOne();
        if (!booking) return null;
        booking.roomItems = await manager
          .getRepository(BookingRoomEntity)
          .find({
            where: { bookingId: id },
            order: { roomId: 'ASC' },
          });
        const result = await operation(booking);
        await repository.save(booking);
        return result;
      });
    } catch (error) {
      this.rethrowPersistenceConflict(error);
    }
  }

  private rethrowPersistenceConflict(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as {
        code?: string;
        constraint?: string;
      };
      if (driverError.code === '23505') {
        if (driverError.constraint === 'UQ_bookings_booking_code') {
          throw new BookingCodeConflictException();
        }
        throw new BookingTransactionConflictException();
      }
      if (
        driverError.code === '23503' &&
        driverError.constraint ===
          'FK_bookings_cancellation_policy_id_cancellation_policies_id'
      ) {
        throw new BookingCancellationPolicyReferenceException();
      }
      if (
        driverError.code === '23503' &&
        driverError.constraint === 'FK_booking_rooms_room_id_rooms_id'
      ) {
        throw new BookingRoomReferenceException();
      }
    }
    throw error;
  }

  private sortRoomItems(booking: BookingEntity): void {
    booking.roomItems?.sort((left, right) =>
      left.roomId.localeCompare(right.roomId),
    );
  }
}
