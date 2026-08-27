import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

type Counter = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthRateLimitService {
  private readonly counters = new Map<string, Counter>();
  private readonly maxEntries = 50_000;

  constructor(private readonly configService: ConfigService) {}

  assertAllowed(
    scope: string,
    identifiers: Array<string | undefined>,
    limit: number,
    windowMs: number,
  ): void {
    if (this.configService.get<boolean>('security.authRateLimitEnabled') === false) {
      return;
    }

    const now = Date.now();
    const normalized = identifiers
      .map((value) => value?.trim().toLowerCase() || 'unknown')
      .join('\u0000');
    const key = createHash('sha256')
      .update(`${scope}\u0000${normalized}`)
      .digest('hex');
    const current = this.counters.get(key);

    if (!current || current.resetAt <= now) {
      this.ensureCapacity(now);
      this.counters.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (current.count >= limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );
      throw new HttpException(
        `Quá nhiều yêu cầu xác thực — vui lòng thử lại sau ${retryAfterSeconds}s`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
  }

  private ensureCapacity(now: number): void {
    if (this.counters.size < this.maxEntries) return;

    for (const [key, counter] of this.counters) {
      if (counter.resetAt <= now) this.counters.delete(key);
    }

    if (this.counters.size >= this.maxEntries) {
      const oldestKey = this.counters.keys().next().value as string | undefined;
      if (oldestKey) this.counters.delete(oldestKey);
    }
  }
}
