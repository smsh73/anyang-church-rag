import dotenv from 'dotenv';

dotenv.config();

export const azureConfig = {
  openai: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    embeddingDeployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small',
    gptDeployment: process.env.AZURE_OPENAI_GPT_DEPLOYMENT || 'gpt-4'
  },
  search: {
    endpoint: process.env.AZURE_SEARCH_ENDPOINT,
    apiKey: process.env.AZURE_SEARCH_API_KEY,
    indexName: process.env.AZURE_SEARCH_INDEX_NAME || 'anyang-church-transcripts'
  }
};
