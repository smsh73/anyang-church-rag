/**
 * API 테스트 스크립트
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testEndpoint(method, path, body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json();
    
    return {
      status: response.status,
      ok: response.ok,
      data
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('=== API 테스트 시작 ===\n');
  
  // 1. Health Check
  console.log('1. Health Check 테스트...');
  const health = await testEndpoint('GET', '/health');
  console.log(`   Status: ${health.status}, OK: ${health.ok}`);
  if (!health.ok) {
    console.log('   ❌ Health check 실패');
    return;
  }
  console.log('   ✅ Health check 성공\n');
  
  // 2. Root Endpoint
  console.log('2. Root Endpoint 테스트...');
  const root = await testEndpoint('GET', '/');
  console.log(`   Status: ${root.status}, OK: ${root.ok}`);
  if (root.ok && root.data.endpoints) {
    console.log(`   ✅ Endpoints 확인: ${Object.keys(root.data.endpoints).length}개\n`);
  } else {
    console.log('   ❌ Root endpoint 실패\n');
  }
  
  // 3. AI Keys API 테스트
  console.log('3. AI Keys API 테스트...');
  
  // 3.1 List
  const listKeys = await testEndpoint('GET', '/api/ai-keys');
  console.log(`   GET /api/ai-keys: ${listKeys.status}`);
  
  // 3.2 Create (테스트용 - 실제 키 없이)
  const createKey = await testEndpoint('POST', '/api/ai-keys', {
    provider: 'openai',
    apiKey: 'test-key',
    name: 'test'
  });
  console.log(`   POST /api/ai-keys: ${createKey.status}`);
  
  if (createKey.ok && createKey.data.key) {
    const keyId = createKey.data.key.id;
    
    // 3.3 Update
    const updateKey = await testEndpoint('PUT', `/api/ai-keys/${keyId}`, {
      is_active: false
    });
    console.log(`   PUT /api/ai-keys/${keyId}: ${updateKey.status}`);
    
    // 3.4 Delete
    const deleteKey = await testEndpoint('DELETE', `/api/ai-keys/${keyId}`);
    console.log(`   DELETE /api/ai-keys/${keyId}: ${deleteKey.status}`);
  }
  
  console.log('   ✅ AI Keys API 테스트 완료\n');
  
  // 4. Extract API 테스트 (실제 YouTube URL 필요)
  console.log('4. Extract API 테스트...');
  console.log('   ⚠️  실제 YouTube URL이 필요합니다 (스킵)\n');
  
  // 5. Bible Search API 테스트
  console.log('5. Bible Search API 테스트...');
  const bibleSearch = await testEndpoint('POST', '/api/bible/search', {
    query: '사랑',
    top: 5
  });
  console.log(`   POST /api/bible/search: ${bibleSearch.status}`);
  if (bibleSearch.ok) {
    console.log(`   ✅ 결과: ${bibleSearch.data.count || 0}개\n`);
  } else {
    console.log(`   ⚠️  ${bibleSearch.error || '검색 실패 (데이터 없을 수 있음)'}\n`);
  }
  
  console.log('=== 테스트 완료 ===');
}

// Node.js에서 fetch 사용 (Node 18+)
if (typeof fetch === 'undefined') {
  console.log('Node.js 18+ 또는 node-fetch 패키지가 필요합니다.');
  process.exit(1);
}

runTests().catch(console.error);
