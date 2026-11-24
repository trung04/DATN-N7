import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageEntity } from './entities/image.entity';

@Module({ imports: [TypeOrmModule.forFeature([ImageEntity])] })
export class MediaModule {}
