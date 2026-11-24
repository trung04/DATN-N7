import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CancellationPolicyEntity } from '../entities/cancellation-policy.entity';
import { CancellationPolicyNameConflictException } from '../exceptions/cancellation-policy.exceptions';
import type {
  CancellationPolicyPage,
  CancellationPolicyRepository,
  CreateCancellationPolicyData,
  FindCancellationPoliciesOptions,
} from '../interfaces/cancellation-policy.repository.interface';

@Injectable()
export class TypeOrmCancellationPolicyRepository implements CancellationPolicyRepository {
  constructor(
    @InjectRepository(CancellationPolicyEntity)
    private readonly repository: Repository<CancellationPolicyEntity>,
  ) {}

  findById(id: string): Promise<CancellationPolicyEntity | null> {
    return this.repository.findOneBy({ id });
  }

  findByHotelAndName(
    hotelId: string,
    name: string,
  ): Promise<CancellationPolicyEntity | null> {
    return this.repository
      .createQueryBuilder('policy')
      .where('policy.hotelId = :hotelId', { hotelId })
      .andWhere('LOWER(policy.name) = LOWER(:name)', { name })
      .getOne();
  }

  async findPage(
    options: FindCancellationPoliciesOptions,
  ): Promise<CancellationPolicyPage> {
    const query = this.repository.createQueryBuilder('policy');

    if (options.search) {
      const escapedSearch = options.search.replace(/[\\%_]/g, '\\$&');
      query.andWhere(
        `(policy.name ILIKE :search ESCAPE '\\'
          OR policy.description ILIKE :search ESCAPE '\\')`,
        { search: `%${escapedSearch}%` },
      );
    }
    if (options.hotelId) {
      query.andWhere('policy.hotelId = :hotelId', {
        hotelId: options.hotelId,
      });
    }

    const sortColumns: Record<
      FindCancellationPoliciesOptions['sortBy'],
      string
    > = {
      name: 'policy.name',
      cancellationWindow: 'policy.cancellationWindow',
      cancellationFeeRate: 'policy.cancellationFeeRate',
    };

    const [items, total] = await query
      .orderBy(sortColumns[options.sortBy], options.sortOrder, 'NULLS LAST')
      .addOrderBy('policy.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    return { items, total };
  }

  async create(
    data: CreateCancellationPolicyData,
  ): Promise<CancellationPolicyEntity> {
    try {
      return await this.repository.save(this.repository.create(data));
    } catch (error) {
      this.rethrowNameConflict(error, data.hotelId, data.name);
    }
  }

  async save(
    policy: CancellationPolicyEntity,
  ): Promise<CancellationPolicyEntity> {
    try {
      return await this.repository.save(policy);
    } catch (error) {
      this.rethrowNameConflict(error, policy.hotelId, policy.name);
    }
  }

  async delete(policy: CancellationPolicyEntity): Promise<void> {
    await this.repository.remove(policy);
  }

  private rethrowNameConflict(
    error: unknown,
    hotelId: string,
    name: string,
  ): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      throw new CancellationPolicyNameConflictException(hotelId, name);
    }
    throw error;
  }
}
