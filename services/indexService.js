import { SearchClient, SearchIndexClient, AzureKeyCredential } from '@azure/search-documents';
import { azureConfig } from '../config/azureConfig.js';

const searchIndexClient = new SearchIndexClient(
  azureConfig.search.endpoint,
  new AzureKeyCredential(azureConfig.search.apiKey)
);

const searchClient = new SearchClient(
  azureConfig.search.endpoint,
  azureConfig.search.indexName,
  new AzureKeyCredential(azureConfig.search.apiKey)
);

/**
 * 인덱스 생성
 */
export async function createIndex() {
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
        dimensions: 1536,
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
    // 배치 업로드
    await searchClient.uploadDocuments(documents);
    console.log(`Indexed ${documents.length} documents`);
  } catch (error) {
    throw new Error(`Indexing failed: ${error.message}`);
  }
}
