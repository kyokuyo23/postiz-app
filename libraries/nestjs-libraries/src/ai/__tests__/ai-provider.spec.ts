import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import {
  aiProvider,
  claudeModel,
  isImageAiConfigured,
  langchainChatModel,
} from '../ai.provider';

const KEYS = ['AI_PROVIDER', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_MODEL'];

describe('ai.provider', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('is off without keys', () => {
    expect(aiProvider()).toBeNull();
    expect(isImageAiConfigured()).toBe(false);
  });

  it('keeps OpenAI for existing installs with only an OpenAI key', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(aiProvider()).toBe('openai');
    expect(langchainChatModel('gpt-4.1')).toBeInstanceOf(ChatOpenAI);
  });

  it('uses Claude when an Anthropic key is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(aiProvider()).toBe('anthropic');
    const model = langchainChatModel('gpt-4.1', { temperature: 0.7 });
    expect(model).toBeInstanceOf(ChatAnthropic);
    expect((model as ChatAnthropic).model).toBe('claude-sonnet-5-5');
    expect(isImageAiConfigured()).toBe(false);
  });

  it('prefers Claude when both keys exist, unless AI_PROVIDER=openai', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(aiProvider()).toBe('anthropic');
    expect(isImageAiConfigured()).toBe(true);
    process.env.AI_PROVIDER = 'openai';
    expect(aiProvider()).toBe('openai');
  });

  it('ignores AI_PROVIDER pointing at a provider without a key', () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(aiProvider()).toBe('openai');
  });

  it('lets ANTHROPIC_MODEL override the model', () => {
    process.env.ANTHROPIC_MODEL = 'claude-opus-5-5';
    expect(claudeModel()).toBe('claude-opus-5-5');
  });
});
