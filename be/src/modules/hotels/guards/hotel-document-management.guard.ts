import { BadRequestException, type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { HotelDocumentsService } from '../services/hotel-documents.service';

@Injectable()
export class HotelDocumentManagementGuard implements CanActivate {
  constructor(private readonly documents: HotelDocumentsService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const hotelId = request.params.hotelId;
    if (typeof hotelId !== 'string' || !isUUID(hotelId, '4')) throw new BadRequestException('hotelId must be a UUID v4');
    await this.documents.assertCanEdit(hotelId, request.authUser!);
    return true;
  }
}
