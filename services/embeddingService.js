import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { azureConfig } from '../config/azureConfig.js';
import { getApiKey } from './aiKeyManager.js';

let client;

function getOpenAIClient() {
  // Azure OpenAI 설정이 있으면 우선 사용
  if (azureConfig.openai.endpoint && azureConfig.openai.apiKey) {
    if (!client) {
      client = new OpenAIClient(
        azureConfig.openai.endpoint,
        new AzureKeyCredential(azureConfig.openai.apiKey)
      );
    }
    return { client, isAzure: true };
  }
  
  // Azure 설정이 없으면 저장된 API 키 사용
  return { client: null, isAzure: false };
}

/**
 * 벡터 임베딩 생성 (text-embedding-ada-002 사용, 768차원)
 * @param {Array} chunks - 청크 배열
 * @returns {Promise<Array>} 임베딩이 추가된 청크 배열
 */
export async function generateEmbeddings(chunks) {
  if (!chunks || chunks.length === 0) {
    throw new Error('Chunks array is empty');
  }

  const texts = chunks.map(chunk => chunk.fullText || chunk.chunkText || '');
  if (texts.some(text => !text || text.trim().length === 0)) {
    throw new Error('Some chunks have empty text');
  }

  const { client: openaiClient, isAzure } = getOpenAIClient();
  const deploymentName = azureConfig.openai.embeddingDeployment || 'text-embedding-ada-002';
  
  if (!openaiClient && !isAzure) {
    // Azure 설정이 없으면 저장된 API 키로 시도
    const apiKeyData = await getApiKey('openai');
    if (!apiKeyData) {
      throw new Error('OpenAI API key not found. Please configure Azure OpenAI or add OpenAI API key in settings.');
    }
    
    // 일반 OpenAI 사용 (fallback)
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: apiKeyData.api_key
    });
    
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: texts
      });
      
      return chunks.map((chunk, index) => ({
        ...chunk,
        embedding: response.data[index].embedding
      }));
    } catch (error) {
      console.warn('Batch embedding failed, processing individually:', error.message);
      return await processEmbeddingsIndividually(chunks, texts, openai, 'text-embedding-ada-002');
    }
  }
  
  // Azure OpenAI 사용
  try {
    const response = await openaiClient.getEmbeddings(deploymentName, texts);
    
    return chunks.map((chunk, index) => ({
      ...chunk,
      embedding: response.data[index].embedding
    }));
  } catch (error) {
    console.warn('Batch embedding failed, processing individually:', error.message);
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const response = await openaiClient.getEmbeddings(deploymentName, [chunks[i].fullText || chunks[i].chunkText]);
        results.push({
          ...chunks[i],
          embedding: response.data[0].embedding
        });
      } catch (err) {
        console.error(`Embedding generation failed for chunk ${i}:`, err.message);
        throw new Error(`Embedding generation failed for chunk ${i}: ${err.message}`);
      }
    }
    return results;
  }
}

/**
 * 개별 임베딩 처리 (fallback)
 */
async function processEmbeddingsIndividually(chunks, texts, openai, model) {
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      const response = await openai.embeddings.create({
        model: model,
        input: [texts[i]]
      });
      results.push({
        ...chunks[i],
        embedding: response.data[0].embedding
      });
    } catch (err) {
      console.error(`Embedding generation failed for chunk ${i}:`, err.message);
      throw new Error(`Embedding generation failed for chunk ${i}: ${err.message}`);
    }
  }
  return results;
}
