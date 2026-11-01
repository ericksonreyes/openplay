import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';

@Controller('public')
@Public()
export class PublicController {
  @Get('status')
  status() {
    return {
      type: 'status',
      id: 'openplay-backend',
      attributes: { status: 'ok', service: 'openplay-backend', version: '0.0.1' },
    };
  }
}
