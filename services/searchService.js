import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { OpenAIClient, AzureKeyCredential as AzureOpenAICredential } from '@azure/openai';
import { azureConfig } from '../config/azureConfig.js';
import { getApiKey } from './aiKeyManager.js';
import { generateEmbeddings } from './embeddingService.js';

// 지연 초기화를 위한 클라이언트 변수
let searchClient = null;
let openaiClient = null;

/**
 * Azure Search 클라이언트 초기화 (지연 로딩)
 */
function initializeSearchClient() {
  if (!azureConfig.search.endpoint || !azureConfig.search.apiKey) {
    throw new Error('Azure Search configuration is missing. Please set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY environment variables.');
  }
  
  if (!searchClient) {
    searchClient = new SearchClient(
      azureConfig.search.endpoint,
      azureConfig.search.indexName,
      new AzureKeyCredential(azureConfig.search.apiKey)
    );
  }
  
  return searchClient;
}

/**
 * 쿼리 임베딩 생성 (OpenAI API key 우선 사용)
 */
async function generateQueryEmbedding(query) {
  // generateEmbeddings 함수를 재사용 (OpenAI API key 우선 사용)
  const result = await generateEmbeddings([{ fullText: query }]);
  return result[0].embedding;
}

/**
 * 하이브리드 검색 (키워드 + 벡터)
 * @param {string} query - 검색 쿼리
 * @param {Object} options - 검색 옵션
 * @returns {Promise<Array>} 검색 결과
 */
export async function hybridSearch(query, options = {}) {
  const {
    serviceType = null,
    serviceDateFrom = null,
    serviceDateTo = null,
    videoId = null,
    top = 5
  } = options;
  
  // 쿼리 임베딩 생성 (OpenAI API key 우선 사용)
  const embeddingVector = await generateQueryEmbedding(query);
  
  // 필터 구성
  const filters = [];
  if (serviceType) {
    filters.push(`serviceType eq '${serviceType}'`);
  }
  if (serviceDateFrom) {
    filters.push(`serviceDate ge ${new Date(serviceDateFrom).toISOString()}`);
  }
  if (serviceDateTo) {
    filters.push(`serviceDate le ${new Date(serviceDateTo).toISOString()}`);
  }
  if (videoId) {
    filters.push(`videoId eq '${videoId}'`);
  }
  
  const filter = filters.length > 0 ? filters.join(' and ') : undefined;
  
  // 하이브리드 검색 실행
  // Azure AI Search의 하이브리드 검색은 search와 vectorSearch를 동시에 사용
  const searchOptions = {
    filter,
    top,
    includeTotalCount: true
  };
  
  // 벡터 검색 옵션 추가
  if (embeddingVector) {
    searchOptions.vectorSearchOptions = {
      queries: [
        {
          kind: 'vector',
          vector: embeddingVector,
          kNearestNeighborsCount: top,
          fields: 'embedding'
        }
      ]
    };
  }
  
  const searchClient = initializeSearchClient();
  const searchResults = await searchClient.search(query, searchOptions);
  
  const results = [];
  for await (const result of searchResults.results) {
    results.push({
      id: result.document.id,
      chunkText: result.document.chunkText,
      score: result.score,
      metadata: {
        videoId: result.document.videoId,
        serviceType: result.document.serviceType,
        serviceDate: result.document.serviceDate,
        videoTitle: result.document.videoTitle,
        chunkIndex: result.document.chunkIndex,
        startTime: result.document.startTime,
        endTime: result.document.endTime
      }
    });
  }
  
  return results;
}

/**
 * RAG 질의응답
 * @param {string} query - 질문
 * @param {Object} options - 검색 옵션
 * @returns {Promise<string>} 응답
 */
export async function ragQuery(query, options = {}) {
  // 검색 결과 가져오기
  const searchResults = await hybridSearch(query, { ...options, top: 3 });
  
  if (searchResults.length === 0) {
    return '관련된 정보를 찾을 수 없습니다.';
  }
  
  // 컨텍스트 구성
  const context = searchResults
    .map((result, index) => `[${index + 1}] ${result.chunkText}`)
    .join('\n\n');
  
  const prompt = `다음 문서들을 참고하여 질문에 답변하세요. 문서의 내용을 바탕으로 정확하고 상세하게 답변해주세요.

문서들:
${context}

질문: ${query}

답변:`;
  
  try {
    // OpenAI API key 우선 사용, 없으면 Azure OpenAI 사용
    const { callOpenAI } = await import('./aiService.js');
    
    // 저장된 OpenAI API key가 있으면 사용
    const apiKeyData = await getApiKey('openai');
    if (apiKeyData && apiKeyData.api_key) {
      const answer = await callOpenAI(
        [
          {
            role: 'system',
            content: '당신은 교회 예배 내용에 대한 질문에 답변하는 전문가입니다. 제공된 문서를 바탕으로 정확하고 상세하게 답변해주세요.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        {
          temperature: 0.7,
          max_tokens: 2000,
          model: 'gpt-4'
        }
      );
      return answer;
    }
    
    // OpenAI API key가 없으면 Azure OpenAI 사용 (fallback)
    if (azureConfig.openai.endpoint && azureConfig.openai.apiKey) {
      if (!openaiClient) {
        openaiClient = new OpenAIClient(
          azureConfig.openai.endpoint,
          new AzureOpenAICredential(azureConfig.openai.apiKey)
        );
      }
      const response = await openaiClient.getChatCompletions(
        azureConfig.openai.gptDeployment || 'gpt-4',
        [
          {
            role: 'system',
            content: '당신은 교회 예배 내용에 대한 질문에 답변하는 전문가입니다. 제공된 문서를 바탕으로 정확하고 상세하게 답변해주세요.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        {
          temperature: 0.7,
          maxTokens: 2000
        }
      );
      return response.choices[0].message.content;
    }
    
    throw new Error('OpenAI API key not found. Please add OpenAI API key in settings or configure Azure OpenAI.');
  } catch (error) {
    throw new Error(`RAG query failed: ${error.message}`);
  }
}
