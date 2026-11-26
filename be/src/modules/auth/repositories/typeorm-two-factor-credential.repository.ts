import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TwoFactorCredentialEntity } from '../entities/two-factor-credential.entity';
import type {
  TwoFactorCredential,
  TwoFactorCredentialRepository,
} from '../interfaces/two-factor-credential.repository.interface';

@Injectable()
export class TypeOrmTwoFactorCredentialRepository
  implements TwoFactorCredentialRepository
{
  constructor(
    @InjectRepository(TwoFactorCredentialEntity)
    private readonly repository: Repository<TwoFactorCredentialEntity>,
  ) {}

  findByUserId(userId: string): Promise<TwoFactorCredentialEntity | null> {
    return this.repository.findOneBy({ userId });
  }

  save(credential: TwoFactorCredential): Promise<TwoFactorCredentialEntity> {
    return this.repository.save(this.repository.create(credential));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }
}
