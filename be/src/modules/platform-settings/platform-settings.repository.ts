import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Column, Entity, PrimaryColumn, Repository, UpdateDateColumn } from 'typeorm';

@Entity('platform_settings')
export class PlatformSettingsEntity {
  @PrimaryColumn({ length: 30 })
  section: string;

  @Column({ name: 'encrypted_value', type: 'text' })
  encryptedValue: string;

  @Column({ type: 'integer' })
  revision: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Injectable()
export class PlatformSettingsRepository {
  constructor(@InjectRepository(PlatformSettingsEntity) private readonly rows: Repository<PlatformSettingsEntity>) {}

  findAll(): Promise<PlatformSettingsEntity[]> {
    return this.rows.find();
  }

  async save(section: string, encryptedValue: string, revision: number, updatedBy: string): Promise<boolean> {
    if (revision === 0) {
      const result = await this.rows.createQueryBuilder().insert()
        .values({ section, encryptedValue, revision: 1, updatedBy }).orIgnore().returning('revision').execute();
      return Array.isArray(result.raw) && result.raw.length === 1;
    }
    const result = await this.rows.update({ section, revision }, { encryptedValue, revision: revision + 1, updatedBy });
    return result.affected === 1;
  }
}
