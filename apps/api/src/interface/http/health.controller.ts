import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/interface/http/decorators';

/** Comprobación de vida (la usa App Platform). */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health(): { ok: true; ts: string } {
    return { ok: true, ts: new Date().toISOString() };
  }
}
