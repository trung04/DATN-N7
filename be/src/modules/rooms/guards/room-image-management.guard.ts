import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { RoomImagesService } from '../services/room-images.service';
@Injectable()
export class RoomImageManagementGuard implements CanActivate {
  constructor(private readonly images: RoomImagesService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const roomId = request.params.roomId;
    if (typeof roomId !== 'string' || !isUUID(roomId, '4'))
      throw new BadRequestException('roomId must be a UUID v4');
    await this.images.assertCanManage(roomId, request.authUser!);
    return true;
  }
}
