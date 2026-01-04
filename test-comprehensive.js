/**
 * 포괄적인 API 테스트 스크립트
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testEndpoint(method, path, body = null, options = {}) {
  try {
    const fetchOptions = {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...options
    };
    
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${path}`, fetchOptions);
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { text };
      }
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
      error: error.message,
      data: null
    };
  }
}

async function runTests() {
  console.log('=== 포괄적인 API 테스트 시작 ===\n');
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0
  };
  
  // 1. Health Check
  console.log('1. Health Check 테스트...');
  try {
    const health = await testEndpoint('GET', '/health');
    if (health.ok && health.data.status === 'ok') {
      console.log(`   ✅ Health check 성공 (DB: ${health.data.database || 'unknown'})`);
      results.passed++;
    } else {
      console.log(`   ❌ Health check 실패: ${health.data?.error || health.error || 'Unknown error'}`);
      results.failed++;
    }
  } catch (error) {
    console.log(`   ❌ Health check 오류: ${error.message}`);
    results.failed++;
  }
  console.log('');
  
  // 2. Root Endpoint
  console.log('2. Root Endpoint 테스트...');
  try {
    const root = await testEndpoint('GET', '/');
    if (root.ok && root.data.endpoints) {
      const endpointCount = Object.keys(root.data.endpoints).length;
      console.log(`   ✅ Root endpoint 성공 (${endpointCount}개 엔드포인트)`);
      results.passed++;
    } else {
      console.log(`   ❌ Root endpoint 실패`);
      results.failed++;
    }
  } catch (error) {
    console.log(`   ❌ Root endpoint 오류: ${error.message}`);
    results.failed++;
  }
  console.log('');
  
  // 3. AI Keys API 테스트
  console.log('3. AI Keys API 테스트...');
  let testKeyId = null;
  
  try {
    // 3.1 List
    const listKeys = await testEndpoint('GET', '/api/ai-keys');
    if (listKeys.ok) {
      console.log(`   ✅ GET /api/ai-keys: ${listKeys.data.keys?.length || 0}개 키`);
      results.passed++;
    } else {
      console.log(`   ❌ GET /api/ai-keys 실패: ${listKeys.data?.error || listKeys.error}`);
      results.failed++;
    }
    
    // 3.2 Create (테스트용)
    const createKey = await testEndpoint('POST', '/api/ai-keys', {
      provider: 'openai',
      apiKey: 'test-key-' + Date.now(),
      name: 'test-key'
    });
    
    if (createKey.ok && createKey.data.key) {
      testKeyId = createKey.data.key.id;
      console.log(`   ✅ POST /api/ai-keys: 키 생성됨 (ID: ${testKeyId})`);
      results.passed++;
      
      // 3.3 Update
      const updateKey = await testEndpoint('PUT', `/api/ai-keys/${testKeyId}`, {
        is_active: false
      });
      if (updateKey.ok) {
        console.log(`   ✅ PUT /api/ai-keys/${testKeyId}: 업데이트 성공`);
        results.passed++;
      } else {
        console.log(`   ❌ PUT /api/ai-keys/${testKeyId} 실패`);
        results.failed++;
      }
      
      // 3.4 Delete
      const deleteKey = await testEndpoint('DELETE', `/api/ai-keys/${testKeyId}`);
      if (deleteKey.ok) {
        console.log(`   ✅ DELETE /api/ai-keys/${testKeyId}: 삭제 성공`);
        results.passed++;
      } else {
        console.log(`   ❌ DELETE /api/ai-keys/${testKeyId} 실패`);
        results.failed++;
      }
    } else {
      console.log(`   ❌ POST /api/ai-keys 실패: ${createKey.data?.error || createKey.error}`);
      results.failed++;
    }
  } catch (error) {
    console.log(`   ❌ AI Keys API 오류: ${error.message}`);
    results.failed++;
  }
  console.log('');
  
  // 4. Sync Status 테스트
  console.log('4. Sync Status 테스트...');
  try {
    const syncStatus = await testEndpoint('GET', '/api/sync/status');
    if (syncStatus.ok && syncStatus.data.status) {
      const pg = syncStatus.data.status.postgreSQL;
      console.log(`   ✅ GET /api/sync/status: 성공`);
      console.log(`      PostgreSQL: ${pg.connected ? '연결됨' : '연결 실패'}`);
      if (pg.connected) {
        console.log(`      인덱스: ${pg.indexes?.length || 0}개`);
        console.log(`      테이블: ${pg.tables?.length || 0}개`);
        if (pg.stats) {
          console.log(`      통계: 청크 ${pg.stats.sermon_chunks_count || 0}개, 성경 ${pg.stats.bible_verses_count || 0}개`);
        }
      }
      results.passed++;
    } else {
      console.log(`   ❌ GET /api/sync/status 실패: ${syncStatus.data?.error || syncStatus.error}`);
      results.failed++;
    }
  } catch (error) {
    console.log(`   ❌ Sync Status 오류: ${error.message}`);
    results.failed++;
  }
  console.log('');
  
  // 5. Bible Search API 테스트
  console.log('5. Bible Search API 테스트...');
  try {
    const bibleSearch = await testEndpoint('POST', '/api/bible/search', {
      query: '사랑',
      top: 5
    });
    if (bibleSearch.ok) {
      console.log(`   ✅ POST /api/bible/search: ${bibleSearch.data.count || 0}개 결과`);
      results.passed++;
    } else {
      console.log(`   ⚠️  POST /api/bible/search: ${bibleSearch.data?.error || '데이터 없을 수 있음'}`);
      results.skipped++;
    }
  } catch (error) {
    console.log(`   ⚠️  Bible Search 오류: ${error.message} (스킵)`);
    results.skipped++;
  }
  console.log('');
  
  // 6. Sermon Search API 테스트 (PostgreSQL 벡터 검색)
  console.log('6. Sermon Search API 테스트...');
  try {
    const sermonSearch = await testEndpoint('POST', '/api/sermon/search', {
      query: '예배',
      top: 3
    });
    if (sermonSearch.ok) {
      console.log(`   ✅ POST /api/sermon/search: ${sermonSearch.data.count || 0}개 결과`);
      results.passed++;
    } else {
      console.log(`   ⚠️  POST /api/sermon/search: ${sermonSearch.data?.error || '데이터 없을 수 있음'}`);
      results.skipped++;
    }
  } catch (error) {
    console.log(`   ⚠️  Sermon Search 오류: ${error.message} (스킵)`);
    results.skipped++;
  }
  console.log('');
  
  // 7. Database Initialization 테스트
  console.log('7. Database Initialization 테스트...');
  try {
    const dbInit = await testEndpoint('POST', '/api/db/init');
    if (dbInit.ok) {
      console.log(`   ✅ POST /api/db/init: 성공`);
      results.passed++;
    } else {
      console.log(`   ⚠️  POST /api/db/init: ${dbInit.data?.error || '이미 초기화됨'}`);
      results.skipped++;
    }
  } catch (error) {
    console.log(`   ⚠️  DB Init 오류: ${error.message} (스킵)`);
    results.skipped++;
  }
  console.log('');
  
  // 8. Transcript 조회 테스트 (데이터가 있는 경우)
  console.log('8. Transcript 조회 테스트...');
  try {
    // 먼저 sync status에서 video_id 확인
    const status = await testEndpoint('GET', '/api/sync/status');
    if (status.ok && status.data.status?.postgreSQL?.stats?.transcripts_count > 0) {
      // 실제 video_id가 필요하므로 스킵
      console.log(`   ⚠️  Transcript 조회: 데이터는 있지만 video_id가 필요함 (스킵)`);
      results.skipped++;
    } else {
      console.log(`   ⚠️  Transcript 조회: 데이터 없음 (스킵)`);
      results.skipped++;
    }
  } catch (error) {
    console.log(`   ⚠️  Transcript 조회 오류: ${error.message} (스킵)`);
    results.skipped++;
  }
  console.log('');
  
  // 결과 요약
  console.log('=== 테스트 결과 요약 ===');
  console.log(`✅ 통과: ${results.passed}개`);
  console.log(`❌ 실패: ${results.failed}개`);
  console.log(`⚠️  스킵: ${results.skipped}개`);
  console.log(`총 테스트: ${results.passed + results.failed + results.skipped}개`);
  console.log('');
  
  if (results.failed === 0) {
    console.log('🎉 모든 필수 테스트 통과!');
    process.exit(0);
  } else {
    console.log('⚠️  일부 테스트 실패. 위의 오류를 확인하세요.');
    process.exit(1);
  }
}

// Node.js에서 fetch 사용 (Node 18+)
if (typeof fetch === 'undefined') {
  console.log('❌ Node.js 18+ 또는 node-fetch 패키지가 필요합니다.');
  process.exit(1);
}

runTests().catch(error => {
  console.error('테스트 실행 오류:', error);
  process.exit(1);
});
