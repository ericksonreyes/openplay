import { Module } from '@nestjs/common';
import { APP_ENV } from '../config/config.module';
import { AppEnv } from '../config/env';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { ASSISTANT_PROVIDER, AssistantProvider } from './providers/provider';
import { StubAssistantProvider } from './providers/stub.provider';
import { OllamaAssistantProvider } from './providers/ollama.provider';
import { AssistantToolRegistry } from './tools/registry';

/**
 * Provider selection (ADR-0006): AI_PROVIDER=stub (default) | ollama.
 * Ollama target comes from OLLAMA_HOST (already in env/compose); the model
 * from AI_MODEL (default llama3.1:8b). AI_PROVIDER/AI_MODEL are read here
 * because env.ts is orchestrator-owned.
 */
const selectProvider = (env: AppEnv): AssistantProvider => {
  const kind = (process.env.AI_PROVIDER ?? 'stub').toLowerCase();
  if (kind === 'ollama') {
    return new OllamaAssistantProvider(
      env.ollamaHost ?? process.env.OLLAMA_HOST ?? '',
      process.env.AI_MODEL ?? 'llama3.1:8b',
    );
  }
  return new StubAssistantProvider();
};

@Module({
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantToolRegistry,
    {
      provide: ASSISTANT_PROVIDER,
      useFactory: selectProvider,
      inject: [APP_ENV],
    },
  ],
})
export class AssistantModule {}
