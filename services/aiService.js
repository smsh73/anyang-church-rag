import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { getApiKey } from './aiKeyManager.js';

/**
 * OpenAI 서비스
 */
export async function callOpenAI(messages, options = {}) {
  const apiKeyData = await getApiKey('openai');
  if (!apiKeyData) {
    throw new Error('OpenAI API key not found');
  }

  const openai = new OpenAI({
    apiKey: apiKeyData.api_key
  });

  const response = await openai.chat.completions.create({
    model: options.model || 'gpt-4',
    messages,
    temperature: options.temperature || 0.7,
    max_tokens: options.max_tokens || 2000
  });

  return response.choices[0].message.content;
}

/**
 * Claude 서비스
 */
export async function callClaude(messages, options = {}) {
  const apiKeyData = await getApiKey('claude');
  if (!apiKeyData) {
    throw new Error('Claude API key not found');
  }

  const anthropic = new Anthropic({
    apiKey: apiKeyData.api_key
  });

  // Claude 메시지 형식 변환
  const systemMessage = messages.find(m => m.role === 'system');
  const userMessages = messages.filter(m => m.role !== 'system');

  const response = await anthropic.messages.create({
    model: options.model || 'claude-3-5-sonnet-20241022',
    max_tokens: options.max_tokens || 2000,
    system: systemMessage?.content || '',
    messages: userMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }))
  });

  return response.content[0].text;
}

/**
 * Google Gemini 서비스
 */
export async function callGemini(prompt, options = {}) {
  const apiKeyData = await getApiKey('gemini');
  if (!apiKeyData) {
    throw new Error('Gemini API key not found');
  }

  const genAI = new GoogleGenerativeAI(apiKeyData.api_key);
  const model = genAI.getGenerativeModel({ 
    model: options.model || 'gemini-pro' 
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

/**
 * Perplexity 서비스
 */
export async function callPerplexity(messages, options = {}) {
  const apiKeyData = await getApiKey('perplexity');
  if (!apiKeyData) {
    throw new Error('Perplexity API key not found');
  }

  const response = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: options.model || 'llama-3.1-sonar-large-128k-online',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKeyData.api_key}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.choices[0].message.content;
}

/**
 * Mixture of Agents - 여러 AI 모델을 조합하여 사용
 */
export async function mixtureOfAgents(prompt, options = {}) {
  const providers = options.providers || ['openai', 'claude', 'gemini'];
  const results = [];

  for (const provider of providers) {
    try {
      let result;
      const messages = [
        { role: 'system', content: options.systemPrompt || 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ];

      switch (provider) {
        case 'openai':
          result = await callOpenAI(messages, options);
          break;
        case 'claude':
          result = await callClaude(messages, options);
          break;
        case 'gemini':
          result = await callGemini(prompt, options);
          break;
        case 'perplexity':
          result = await callPerplexity(messages, options);
          break;
        default:
          continue;
      }

      results.push({ provider, result, success: true });
    } catch (error) {
      results.push({ provider, error: error.message, success: false });
    }
  }

  // 결과 통합 (간단한 방법: 첫 번째 성공한 결과 반환)
  const successfulResult = results.find(r => r.success);
  if (successfulResult) {
    return {
      primary: successfulResult.result,
      all: results
    };
  }

  throw new Error('All AI providers failed');
}
