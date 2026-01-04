/**
 * 전체 플로우 테스트 (실제 YouTube URL 사용)
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

let fetchFunction;
if (typeof globalThis.fetch !== 'undefined') {
  fetchFunction = globalThis.fetch;
} else {
  try {
    const nodeFetch = await import('node-fetch');
    fetchFunction = nodeFetch.default;
  } catch (e) {
    console.error('node-fetch가 필요합니다');
    process.exit(1);
  }
}

async function testEndpoint(method, path, body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetchFunction(`${BASE_URL}${path}`, options);
    
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

async function testFullFlow() {
  console.log('=== 전체 플로우 테스트 ===\n');
  
  // 테스트할 YouTube URL
  const testUrl = process.env.TEST_YOUTUBE_URL || 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
  const startTime = process.env.TEST_START_TIME || null;
  const endTime = process.env.TEST_END_TIME || null;
  
  console.log(`테스트 URL: ${testUrl}`);
  if (startTime && endTime) {
    console.log(`시간 구간: ${startTime} ~ ${endTime}`);
  } else {
    console.log(`시간 구간: 전체`);
  }
  console.log('');
  
  // 1. Extract 테스트
  console.log('1️⃣  자막/STT 추출 테스트...');
  const extractBody = { url: testUrl };
  if (startTime) extractBody.startTime = startTime;
  if (endTime) extractBody.endTime = endTime;
  
  const extractResult = await testEndpoint('POST', '/api/extract', extractBody);
  
  if (extractResult.ok && extractResult.data.success) {
    console.log(`   ✅ 추출 성공!`);
    console.log(`   - 비디오 ID: ${extractResult.data.videoId}`);
    console.log(`   - 방법: ${extractResult.data.method}`);
    console.log(`   - 세그먼트 수: ${extractResult.data.transcript?.length || 0}개`);
    
    if (extractResult.data.transcript && extractResult.data.transcript.length > 0) {
      console.log(`   - 첫 세그먼트: "${extractResult.data.transcript[0].text?.substring(0, 50)}..."`);
      console.log(`   - 타임스탬프: ${extractResult.data.transcript[0].offset}ms`);
      console.log('');
      
      // 2. 전체 프로세스 테스트
      console.log('2️⃣  전체 프로세스 테스트 (추출 → 보정 → 청킹 → 임베딩 → 저장)...');
      console.log('   ⚠️  OpenAI API Key가 필요합니다.');
      console.log('   ⚠️  시간이 오래 걸릴 수 있습니다 (1-2분)...\n');
      
      const processResult = await testEndpoint('POST', '/api/process', {
        url: testUrl,
        startTime: startTime,
        endTime: endTime,
        autoIndex: false
      });
      
      if (processResult.ok && processResult.data.success) {
        console.log(`   ✅ 전체 프로세스 성공!`);
        console.log(`   - 비디오 ID: ${processResult.data.videoId}`);
        console.log(`   - 처리 방법: ${processResult.data.method}`);
        console.log(`   - 총 청크 수: ${processResult.data.stats.totalChunks}`);
        console.log(`   - 총 문단 수: ${processResult.data.stats.totalParagraphs}`);
        console.log(`   - 총 문자 수: ${processResult.data.stats.totalCharacters}`);
        console.log(`   - 임베딩 모델: ${processResult.data.stats.embeddingModel}`);
        console.log(`   - 임베딩 차원: ${processResult.data.stats.embeddingDimensions}`);
        console.log(`   - 전체 텍스트 저장: ${processResult.data.stats.fullTextSaved ? '✅' : '❌'}`);
        console.log('');
        
        // 3. 저장된 텍스트 조회
        console.log('3️⃣  저장된 텍스트 조회 테스트...');
        const transcriptResult = await testEndpoint('GET', `/api/sermon/transcript/${processResult.data.videoId}`);
        
        if (transcriptResult.ok && transcriptResult.data.success) {
          console.log(`   ✅ 텍스트 조회 성공!`);
          console.log(`   - 전체 텍스트 길이: ${transcriptResult.data.fullText?.length || 0}자`);
          console.log(`   - 문단 수: ${transcriptResult.data.stats.totalParagraphs}`);
          console.log(`   - 문자 수: ${transcriptResult.data.stats.totalCharacters}`);
          console.log(`   - 첫 100자: "${transcriptResult.data.fullText?.substring(0, 100)}..."`);
          console.log('');
        } else {
          console.log(`   ⚠️  텍스트 조회 실패: ${transcriptResult.data?.error || '데이터 없음'}`);
          console.log('');
        }
        
        // 4. 검색 테스트
        console.log('4️⃣  검색 테스트 (PostgreSQL 벡터 검색)...');
        const searchResult = await testEndpoint('POST', '/api/sermon/search', {
          query: '설교',
          top: 3
        });
        
        if (searchResult.ok) {
          console.log(`   ✅ 검색 성공: ${searchResult.data.count || 0}개 결과`);
          if (searchResult.data.results && searchResult.data.results.length > 0) {
            console.log(`   - 첫 결과: "${searchResult.data.results[0].chunkText?.substring(0, 50)}..."`);
            console.log(`   - 유사도: ${searchResult.data.results[0].similarity?.toFixed(3) || 'N/A'}`);
          }
          console.log('');
        } else {
          console.log(`   ⚠️  검색 실패: ${searchResult.data?.error || '알 수 없는 오류'}`);
          console.log('');
        }
        
        console.log('🎉 전체 플로우 테스트 완료!');
        
      } else {
        console.log(`   ❌ 전체 프로세스 실패: ${processResult.data?.error || processResult.error}`);
        console.log('');
      }
    } else {
      console.log(`   ⚠️  자막/STT 세그먼트가 없습니다.`);
      console.log(`   - 시간 구간을 조정하거나 다른 비디오를 시도해보세요.`);
      console.log('');
    }
  } else {
    console.log(`   ❌ 추출 실패: ${extractResult.data?.error || extractResult.error}`);
    console.log('');
  }
  
  console.log('=== 테스트 완료 ===');
}

testFullFlow().catch(error => {
  console.error('테스트 실행 오류:', error);
  process.exit(1);
});
