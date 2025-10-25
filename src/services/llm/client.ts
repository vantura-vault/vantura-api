import axios, { AxiosError } from 'axios';
import { config } from '../../config/env.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionParams {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface ChatCompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Generic OpenAI-compatible chat completion client
 */
export async function chatCompletion({
  messages,
  model = DEFAULT_MODEL,
  temperature = DEFAULT_TEMPERATURE,
  maxTokens = DEFAULT_MAX_TOKENS,
  topP = 1.0,
}: ChatCompletionParams): Promise<ChatCompletionResponse> {
  const apiKey = config.llmApiKey;
  const apiBase = config.llmApiBase || 'https://api.openai.com/v1';

  if (!apiKey) {
    throw new Error('LLM API key not configured. Set LLM_API_KEY in environment.');
  }

  try {
    const response = await axios.post(
      `${apiBase}/chat/completions`,
      {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: DEFAULT_TIMEOUT,
      }
    );

    const choice = response.data.choices?.[0];
    if (!choice || !choice.message) {
      throw new Error('Invalid response from LLM API');
    }

    return {
      content: choice.message.content,
      usage: response.data.usage ? {
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens,
      } : undefined,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        throw new Error(
          `LLM API error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`
        );
      } else if (axiosError.request) {
        throw new Error('LLM API request timeout or network error');
      }
    }
    throw new Error(`LLM client error: ${(error as Error).message}`);
  }
}

/**
 * Retry wrapper for chat completion with exponential backoff
 */
export async function chatCompletionWithRetry(
  params: ChatCompletionParams,
  maxRetries = 3
): Promise<ChatCompletionResponse> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await chatCompletion(params);
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Chat completion failed after retries');
}
