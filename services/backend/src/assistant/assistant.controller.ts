import { Body, Controller, Get, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';

/**
 * Assistant endpoints. Authenticated callers of any scope may use the
 * assistant — no permission gate; the global auth guard's default deny
 * applies (this route is intentionally NOT @Public). Every tool call runs
 * under the caller's verified claims.
 */
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('messages')
  async message(@Body() body: Record<string, unknown>) {
    return this.assistant.handleMessage({
      message: body['message'],
      context: body['context'],
    });
  }

  @Get('status')
  async status() {
    return {
      type: 'assistant-status',
      attributes: await this.assistant.status(),
    };
  }
}
