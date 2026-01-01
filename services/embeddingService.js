import OpenAI from 'openai';
import { getApiKey } from './aiKeyManager.js';

/**
 * 벡터 임베딩 생성 (text-embedding-ada-002 사용, 768차원)
 * @param {Array} chunks - 청크 배열
 * @returns {Promise<Array>} 임베딩이 추가된 청크 배열
 */
export async function generateEmbeddings(chunks) {
  const apiKeyData = await getApiKey('openai');
  if (!apiKeyData) {
    throw new Error('OpenAI API key not found');
  }

  const openai = new OpenAI({
    apiKey: apiKeyData.api_key
  });

  const texts = chunks.map(chunk => chunk.fullText);
  
  try {
    // 배치 처리 (한 번에 여러 텍스트 처리)
    // text-embedding-ada-002는 768차원
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: texts
    });
    
    // 청크에 임베딩 추가
    return chunks.map((chunk, index) => ({
      ...chunk,
      embedding: response.data[index].embedding
    }));
  } catch (error) {
    // 배치가 실패하면 하나씩 처리
    console.warn('Batch embedding failed, processing individually:', error.message);
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: [chunks[i].fullText]
        });
        results.push({
          ...chunks[i],
          embedding: response.data[0].embedding
        });
      } catch (err) {
        throw new Error(`Embedding generation failed for chunk ${i}: ${err.message}`);
      }
    }
    return results;
  }
}
