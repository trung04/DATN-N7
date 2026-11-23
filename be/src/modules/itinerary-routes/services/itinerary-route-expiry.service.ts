import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ItineraryRoutesService } from './itinerary-routes.service';

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class ItineraryRouteExpiryService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ItineraryRouteExpiryService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly routesService: ItineraryRoutesService) {}

  onModuleInit(): void {
    void this.cleanup();
    this.timer = setInterval(() => void this.cleanup(), CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async cleanup(): Promise<void> {
    try {
      const deleted = await this.routesService.purgeExpired();
      if (deleted > 0) this.logger.log(`Deleted ${deleted} expired route(s).`);
    } catch {
      this.logger.error('Failed to delete expired itinerary routes.');
    }
  }
}
