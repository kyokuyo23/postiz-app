import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Chooses the text AI provider for every AI feature (assistant, agent,
 * generator, auto post, slides).
 *
 *   AI_PROVIDER=anthropic | openai   explicit choice
 *   otherwise Claude when ANTHROPIC_API_KEY is set, else OpenAI.
 *
 * Image generation is OpenAI-only (Claude does not generate images), so it
 * keeps requiring OPENAI_API_KEY.
 */
export type AiProvider = 'anthropic' | 'openai';

const has = (value?: string) => !!value && value.trim() !== '';

export const aiProvider = (): AiProvider | null => {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === 'anthropic' && has(process.env.ANTHROPIC_API_KEY)) {
    return 'anthropic';
  }
  if (explicit === 'openai' && has(process.env.OPENAI_API_KEY)) {
    return 'openai';
  }
  if (has(process.env.ANTHROPIC_API_KEY)) {
    return 'anthropic';
  }
  if (has(process.env.OPENAI_API_KEY)) {
    return 'openai';
  }
  return null;
};

export const isAiConfigured = () => aiProvider() !== null;

export const isImageAiConfigured = () => has(process.env.OPENAI_API_KEY);

/** Claude model used for all text features. */
export const claudeModel = () =>
  process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-5-5';

/**
 * LangChain chat model for the active provider. `openaiModel` keeps each
 * feature's existing OpenAI model when OpenAI is the provider.
 */
export const langchainChatModel = (
  openaiModel: string,
  options: { temperature?: number } = {}
): BaseChatModel => {
  if (aiProvider() === 'anthropic') {
    return new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: claudeModel(),
      maxTokens: 8192,
      ...(options.temperature !== undefined
        ? { temperature: options.temperature }
        : {}),
    });
  }
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
    model: openaiModel,
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
  });
};
