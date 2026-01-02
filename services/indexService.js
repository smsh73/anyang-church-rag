import { SearchClient, SearchIndexClient, AzureKeyCredential } from '@azure/search-documents';
import { azureConfig } from '../config/azureConfig.js';

// 지연 초기화를 위한 클라이언트 변수
let searchIndexClient = null;
let searchClient = null;

/**
 * Azure Search 클라이언트 초기화 (지연 로딩)
 */
function initializeClients() {
  if (!azureConfig.search.endpoint || !azureConfig.search.apiKey) {
    throw new Error('Azure Search configuration is missing. Please set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY environment variables.');
  }
  
  if (!searchIndexClient) {
    searchIndexClient = new SearchIndexClient(
      azureConfig.search.endpoint,
      new AzureKeyCredential(azureConfig.search.apiKey)
    );
  }
  
  if (!searchClient) {
    searchClient = new SearchClient(
      azureConfig.search.endpoint,
      azureConfig.search.indexName,
      new AzureKeyCredential(azureConfig.search.apiKey)
    );
  }
  
  return { searchIndexClient, searchClient };
}

/**
 * 인덱스 생성
 */
export async function createIndex() {
  const { searchIndexClient } = initializeClients();
  
  const indexDefinition = {
    name: azureConfig.search.indexName,
    fields: [
      {
        name: 'id',
        type: 'Edm.String',
        key: true
      },
      {
        name: 'videoId',
        type: 'Edm.String',
        filterable: true,
        searchable: true
      },
      {
        name: 'chunkText',
        type: 'Edm.String',
        searchable: true,
        analyzer: 'ko.lucene'
      },
      {
        name: 'fullText',
        type: 'Edm.String',
        searchable: true,
        analyzer: 'ko.lucene'
      },
      {
        name: 'embedding',
        type: 'Collection(Edm.Single)',
        dimensions: 768, // text-embedding-ada-002는 768차원
        vectorSearchProfile: 'default-vector-profile'
      },
      {
        name: 'serviceType',
        type: 'Edm.String',
        filterable: true,
        facetable: true
      },
      {
        name: 'serviceDate',
        type: 'Edm.DateTimeOffset',
        filterable: true,
        sortable: true
      },
      {
        name: 'videoTitle',
        type: 'Edm.String',
        searchable: true
      },
      {
        name: 'chunkIndex',
        type: 'Edm.Int32',
        filterable: true
      },
      {
        name: 'startTime',
        type: 'Edm.Int32',
        filterable: true
      },
      {
        name: 'endTime',
        type: 'Edm.Int32',
        filterable: true
      }
    ],
    vectorSearch: {
      profiles: [
        {
          name: 'default-vector-profile',
          algorithm: 'hnsw'
        }
      ],
      algorithms: [
        {
          name: 'hnsw',
          kind: 'hnsw'
        }
      ]
    }
  };
  
  try {
    await searchIndexClient.createOrUpdateIndex(indexDefinition);
    console.log('Index created/updated successfully');
  } catch (error) {
    throw new Error(`Index creation failed: ${error.message}`);
  }
}

/**
 * 문서 인덱싱
 * @param {Array} chunks - 청크 배열 (임베딩 포함)
 */
export async function indexDocuments(chunks) {
  const { searchClient } = initializeClients();
  
  const documents = chunks.map(chunk => ({
    id: chunk.id,
    videoId: chunk.metadata.videoId,
    chunkText: chunk.chunkText,
    fullText: chunk.fullText,
    embedding: chunk.embedding,
    serviceType: chunk.metadata.serviceType,
    serviceDate: chunk.metadata.serviceDate ? new Date(chunk.metadata.serviceDate) : null,
    videoTitle: chunk.metadata.videoTitle,
    chunkIndex: chunk.metadata.chunkIndex,
    startTime: chunk.metadata.startTime,
    endTime: chunk.metadata.endTime
  }));
  
  try {
    // 배치 업로드 (최대 1000개씩)
    const batchSize = 1000;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await searchClient.uploadDocuments(batch);
      console.log(`Indexed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);
    }
    console.log(`Total indexed: ${documents.length} documents`);
  } catch (error) {
    throw new Error(`Indexing failed: ${error.message}`);
  }
}

/**
 * 인덱스 동기화 상태 확인
 */
export async function getIndexStatus() {
  try {
    const { searchIndexClient, searchClient } = initializeClients();
    
    const index = await searchIndexClient.getIndex(azureConfig.search.indexName);
    const stats = await searchClient.getDocumentsCount();
    
    return {
      name: index.name,
      documentCount: stats,
      fields: index.fields.length,
      vectorSearchEnabled: !!index.vectorSearch
    };
  } catch (error) {
    throw new Error(`Failed to get index status: ${error.message}`);
  }
}

/**
 * 인덱스 배포 확인 및 동기화
 */
export async function syncAndDeployIndex() {
  try {
    // 1. 인덱스 생성/업데이트
    console.log('Step 1: Creating/updating index...');
    await createIndex();
    
    // 2. 인덱스 상태 확인
    console.log('Step 2: Checking index status...');
    const status = await getIndexStatus();
    console.log(`Index status: ${JSON.stringify(status, null, 2)}`);
    
    // 3. Azure AI Search는 인덱스 업데이트 후 자동으로 배포됨
    // 하지만 완료를 기다려야 할 수 있음
    console.log('Step 3: Waiting for index deployment...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
    
    return {
      success: true,
      status,
      message: 'Index synchronized and deployed successfully'
    };
  } catch (error) {
    throw new Error(`Index sync failed: ${error.message}`);
  }
}
