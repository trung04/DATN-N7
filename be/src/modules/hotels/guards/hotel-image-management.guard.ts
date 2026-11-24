import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { HotelImagesService } from '../services/hotel-images.service';

@Injectable()
export class HotelImageManagementGuard implements CanActivate {
  constructor(private readonly images: HotelImagesService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const hotelId = request.params.hotelId;
    if (typeof hotelId !== 'string' || !isUUID(hotelId, '4'))
      throw new BadRequestException('hotelId must be a UUID v4');
    await this.images.assertCanManage(hotelId, request.authUser!);
    return true;
  }
}
