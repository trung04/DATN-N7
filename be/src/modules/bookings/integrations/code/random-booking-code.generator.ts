import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { BookingCodeGenerator } from '../../interfaces/booking-code-generator.interface';

@Injectable()
export class RandomBookingCodeGenerator implements BookingCodeGenerator {
  generate(now = new Date()): string {
    const date = now.toISOString().slice(0, 10).replaceAll('-', '');
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    return `BK-${date}-${suffix}`;
  }
}
