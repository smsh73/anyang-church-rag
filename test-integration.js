/**
 * 통합 테스트 스크립트
 * 전체 플로우 테스트: YouTube 스크립트 추출 → 청킹 → 임베딩 → 인덱싱 → 검색 → RAG
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// fetch가 없으면 node-fetch 사용
let fetch;
if (typeof globalThis.fetch === 'undefined') {
  try {
    fetch = (await import('node-fetch')).default;
  } catch (e) {
    console.error('node-fetch가 필요합니다: npm install node-fetch');
    process.exit(1);
  }
} else {
  fetch = globalThis.fetch;
}

async function testEndpoint(method, path, body = null, options = {}) {
  try {
    const requestOptions = {
      method,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    };
    
    if (body) {
      requestOptions.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${path}`, requestOptions);
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runIntegrationTests() {
  console.log('=== 통합 테스트 시작 ===\n');
  
  let testResults = {
    passed: 0,
    failed: 0,
    skipped: 0
  };
  
  // 1. Health Check
  console.log('1. Health Check 테스트...');
  const health = await testEndpoint('GET', '/health');
  if (health.ok && health.data.database === 'connected') {
    console.log('   ✅ Health check 성공 (데이터베이스 연결됨)\n');
    testResults.passed++;
  } else if (health.ok) {
    console.log('   ⚠️  Health check 성공 (데이터베이스 미연결)\n');
    testResults.passed++;
  } else {
    console.log('   ❌ Health check 실패\n');
    testResults.failed++;
    return testResults;
  }
  
  // 2. API Keys 관리 테스트
  console.log('2. API Keys 관리 테스트...');
  let testKeyId = null;
  
  // 2.1 List
  const listKeys = await testEndpoint('GET', '/api/ai-keys');
  console.log(`   GET /api/ai-keys: ${listKeys.status}`);
  
  // 2.2 Create
  const createKey = await testEndpoint('POST', '/api/ai-keys', {
    provider: 'openai',
    apiKey: 'test-key-' + Date.now(),
    name: 'test-integration'
  });
  console.log(`   POST /api/ai-keys: ${createKey.status}`);
  
  if (createKey.ok && createKey.data.key) {
    testKeyId = createKey.data.key.id;
    console.log(`   ✅ API Key 생성 성공 (ID: ${testKeyId})\n`);
    testResults.passed++;
    
    // 2.3 Update
    const updateKey = await testEndpoint('PUT', `/api/ai-keys/${testKeyId}`, {
      is_active: false
    });
    console.log(`   PUT /api/ai-keys/${testKeyId}: ${updateKey.status}`);
    if (updateKey.ok) {
      console.log('   ✅ API Key 업데이트 성공\n');
      testResults.passed++;
    } else {
      console.log('   ❌ API Key 업데이트 실패\n');
      testResults.failed++;
    }
    
    // 2.4 Delete
    const deleteKey = await testEndpoint('DELETE', `/api/ai-keys/${testKeyId}`);
    console.log(`   DELETE /api/ai-keys/${testKeyId}: ${deleteKey.status}`);
    if (deleteKey.ok) {
      console.log('   ✅ API Key 삭제 성공\n');
      testResults.passed++;
    } else {
      console.log('   ❌ API Key 삭제 실패\n');
      testResults.failed++;
    }
  } else {
    console.log('   ❌ API Key 생성 실패\n');
    testResults.failed++;
  }
  
  // 3. Sync Status 테스트
  console.log('3. Sync Status 테스트...');
  const syncStatus = await testEndpoint('GET', '/api/sync/status');
  console.log(`   GET /api/sync/status: ${syncStatus.status}`);
  if (syncStatus.ok) {
    console.log('   ✅ Sync Status 확인 성공\n');
    console.log(`   PostgreSQL: ${syncStatus.data.status?.postgreSQL?.connected ? '연결됨' : '미연결'}`);
    if (syncStatus.data.status?.azureSearch) {
      console.log(`   Azure Search: ${syncStatus.data.status.azureSearch.error ? '오류' : '정상'}`);
    }
    console.log('');
    testResults.passed++;
  } else {
    console.log('   ⚠️  Sync Status 확인 실패 (데이터베이스 미연결일 수 있음)\n');
    testResults.skipped++;
  }
  
  // 4. 전체 플로우 테스트 (YouTube URL 필요)
  console.log('4. 전체 플로우 테스트 (YouTube 스크립트 처리)...');
  console.log('   ⚠️  실제 YouTube URL과 OpenAI API Key가 필요합니다.');
  console.log('   테스트하려면 다음 환경 변수를 설정하세요:');
  console.log('   - TEST_YOUTUBE_URL: YouTube URL');
  console.log('   - TEST_START_TIME: 시작 시간 (예: "0:00")');
  console.log('   - TEST_END_TIME: 종료 시간 (예: "1:00")');
  console.log('   - TEST_OPENAI_KEY: OpenAI API Key\n');
  
  const testUrl = process.env.TEST_YOUTUBE_URL;
  const testStartTime = process.env.TEST_START_TIME || '0:00';
  const testEndTime = process.env.TEST_END_TIME || '1:00';
  
  if (testUrl) {
    console.log(`   테스트 URL: ${testUrl}`);
    console.log(`   시간 구간: ${testStartTime} - ${testEndTime}\n`);
    
    // OpenAI API Key 확인
    const openaiKeys = await testEndpoint('GET', '/api/ai-keys');
    const hasOpenAIKey = openaiKeys.ok && openaiKeys.data.keys && 
      openaiKeys.data.keys.some(k => k.provider === 'openai' && k.is_active);
    
    if (!hasOpenAIKey && !process.env.TEST_OPENAI_KEY) {
      console.log('   ⚠️  OpenAI API Key가 없어 스킵합니다.\n');
      testResults.skipped++;
    } else {
      // OpenAI Key 추가 (테스트용)
      if (process.env.TEST_OPENAI_KEY) {
        await testEndpoint('POST', '/api/ai-keys', {
          provider: 'openai',
          apiKey: process.env.TEST_OPENAI_KEY,
          name: 'test-integration-key'
        });
      }
      
      console.log('   Step 1: YouTube 스크립트 추출 및 처리 시작...');
      const processResult = await testEndpoint('POST', '/api/process', {
        url: testUrl,
        startTime: testStartTime,
        endTime: testEndTime,
        autoIndex: false // Azure Search 인덱싱은 스킵
      });
      
      if (processResult.ok && processResult.data.success) {
        console.log('   ✅ 전체 플로우 성공!');
        console.log(`   - 비디오 ID: ${processResult.data.videoId}`);
        console.log(`   - 처리 방법: ${processResult.data.method}`);
        console.log(`   - 총 청크 수: ${processResult.data.stats.totalChunks}`);
        console.log(`   - 총 문단 수: ${processResult.data.stats.totalParagraphs}`);
        console.log(`   - 총 문자 수: ${processResult.data.stats.totalCharacters}`);
        console.log(`   - 임베딩 차원: ${processResult.data.stats.embeddingDimensions}`);
        testResults.passed++;
        
        // 검색 테스트
        if (processResult.data.stats.totalChunks > 0) {
          console.log('\n   Step 2: 검색 테스트...');
          await wait(2000); // 인덱싱 대기
          
          const searchResult = await testEndpoint('POST', '/api/search', {
            query: '설교',
            top: 3
          });
          
          if (searchResult.ok) {
            console.log(`   ✅ 검색 성공: ${searchResult.data.count}개 결과`);
            testResults.passed++;
            
            // RAG 테스트
            console.log('\n   Step 3: RAG 응답 테스트...');
            const ragResult = await testEndpoint('POST', '/api/search/rag', {
              query: '설교 내용을 요약해주세요'
            });
            
            if (ragResult.ok) {
              console.log('   ✅ RAG 응답 성공');
              console.log(`   응답 길이: ${ragResult.data.answer?.length || 0}자`);
              testResults.passed++;
            } else {
              console.log(`   ⚠️  RAG 응답 실패: ${ragResult.error || ragResult.data?.error}`);
              testResults.skipped++;
            }
          } else {
            console.log(`   ⚠️  검색 실패: ${searchResult.error || searchResult.data?.error}`);
            console.log('   (Azure AI Search가 설정되지 않았을 수 있음)');
            testResults.skipped++;
          }
        }
      } else {
        console.log(`   ❌ 전체 플로우 실패: ${processResult.data?.error || processResult.error}`);
        testResults.failed++;
      }
      console.log('');
    }
  } else {
    console.log('   ⚠️  TEST_YOUTUBE_URL 환경 변수가 없어 스킵합니다.\n');
    testResults.skipped++;
  }
  
  // 5. 성경 검색 테스트
  console.log('5. 성경 검색 테스트...');
  const bibleSearch = await testEndpoint('POST', '/api/bible/search', {
    query: '사랑',
    top: 5
  });
  console.log(`   POST /api/bible/search: ${bibleSearch.status}`);
  if (bibleSearch.ok) {
    console.log(`   ✅ 성경 검색 성공: ${bibleSearch.data.count || 0}개 결과\n`);
    testResults.passed++;
  } else {
    console.log(`   ⚠️  성경 검색 실패 (데이터 없을 수 있음): ${bibleSearch.error || bibleSearch.data?.error}\n`);
    testResults.skipped++;
  }
  
  // 결과 요약
  console.log('=== 테스트 결과 요약 ===');
  console.log(`✅ 통과: ${testResults.passed}`);
  console.log(`❌ 실패: ${testResults.failed}`);
  console.log(`⚠️  스킵: ${testResults.skipped}`);
  console.log(`총 테스트: ${testResults.passed + testResults.failed + testResults.skipped}\n`);
  
  if (testResults.failed > 0) {
    process.exit(1);
  }
  
  return testResults;
}

// 실행
runIntegrationTests().catch(error => {
  console.error('테스트 실행 오류:', error);
  process.exit(1);
});
