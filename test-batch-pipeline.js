/**
 * 배치 처리 파이프라인 전체 테스트
 * 채널/재생목록 배치 처리 및 전체 파이프라인 동작 확인
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// fetch 초기화
let fetchFunction;
if (typeof globalThis.fetch !== 'undefined') {
  fetchFunction = globalThis.fetch;
} else {
  try {
    const nodeFetch = require('node-fetch');
    fetchFunction = nodeFetch.default || nodeFetch;
  } catch (e) {
    console.error('node-fetch가 필요합니다: npm install node-fetch');
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

async function testBatchPipeline() {
  console.log('=== 배치 처리 파이프라인 전체 테스트 ===\n');
  
  // 1. Health Check
  console.log('1. Health Check...');
  const healthResult = await testEndpoint('GET', '/health');
  if (healthResult.ok) {
    console.log('   ✅ 서버 정상 작동');
    console.log(`   - 데이터베이스: ${healthResult.data.database}`);
  } else {
    console.log('   ❌ 서버 연결 실패');
    return;
  }
  console.log('');
  
  // 2. YouTube API 키 확인
  console.log('2. YouTube API 키 확인...');
  const keysResult = await testEndpoint('GET', '/api/ai-keys');
  if (keysResult.ok) {
    const youtubeKey = keysResult.data.keys?.find(k => k.provider === 'youtube' && k.is_active);
    if (youtubeKey) {
      console.log('   ✅ YouTube API 키 발견');
      console.log(`   - 이름: ${youtubeKey.name || 'N/A'}`);
    } else {
      console.log('   ⚠️  YouTube API 키가 없습니다.');
      console.log('   💡 채널/재생목록 목록 가져오기에는 YouTube API 키가 필요합니다.');
      console.log('   💡 관리자 페이지에서 "YouTube Data API" 키를 추가하세요.');
    }
  } else {
    console.log('   ⚠️  API 키 조회 실패');
  }
  console.log('');
  
  // 3. OpenAI API 키 확인
  console.log('3. OpenAI API 키 확인...');
  if (keysResult.ok) {
    const openaiKey = keysResult.data.keys?.find(k => k.provider === 'openai' && k.is_active);
    if (openaiKey) {
      console.log('   ✅ OpenAI API 키 발견');
      console.log(`   - 이름: ${openaiKey.name || 'N/A'}`);
    } else {
      console.log('   ⚠️  OpenAI API 키가 없습니다.');
      console.log('   💡 AI 보정, 메타데이터 추출, 벡터 임베딩에는 OpenAI API 키가 필요합니다.');
    }
  }
  console.log('');
  
  // 4. 단일 동영상 처리 테스트 (전체 파이프라인)
  console.log('4. 단일 동영상 처리 테스트 (전체 파이프라인)...');
  const testVideoUrl = process.env.TEST_VIDEO_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  console.log(`   테스트 URL: ${testVideoUrl}`);
  
  const processResult = await testEndpoint('POST', '/api/process', {
    url: testVideoUrl,
    startTime: null,
    endTime: null,
    autoIndex: false
  });
  
  if (processResult.ok && processResult.data.success) {
    console.log('   ✅ 단일 동영상 처리 성공');
    console.log(`   - 비디오 ID: ${processResult.data.videoId}`);
    console.log(`   - 처리 방법: ${processResult.data.method}`);
    console.log(`   - 총 청크 수: ${processResult.data.stats.totalChunks}`);
    console.log(`   - 총 문단 수: ${processResult.data.stats.totalParagraphs}`);
    console.log(`   - 총 문자 수: ${processResult.data.stats.totalCharacters}`);
    console.log(`   - 임베딩 차원: ${processResult.data.stats.embeddingDimensions}`);
  } else {
    console.log('   ❌ 단일 동영상 처리 실패');
    console.log(`   - 오류: ${processResult.data?.error || processResult.error}`);
    console.log('   💡 이 오류가 해결되지 않으면 배치 처리도 실패할 수 있습니다.');
  }
  console.log('');
  
  // 5. 채널 배치 처리 테스트 (선택사항)
  const testChannelUrl = process.env.TEST_CHANNEL_URL;
  if (testChannelUrl) {
    console.log('5. 채널 배치 처리 테스트...');
    console.log(`   채널 URL: ${testChannelUrl}`);
    console.log('   ⚠️  이 테스트는 시간이 오래 걸릴 수 있습니다.');
    console.log('   ⚠️  최대 동영상 수를 제한하는 것을 권장합니다.\n');
    
    const channelResult = await testEndpoint('POST', '/api/batch/channel/sync', {
      channelUrl: testChannelUrl,
      keyword: process.env.TEST_KEYWORD || null,
      maxVideos: parseInt(process.env.TEST_MAX_VIDEOS || '1'),
      autoIndex: false,
      delayBetweenVideos: 2000
    });
    
    if (channelResult.ok && channelResult.data.success) {
      console.log('   ✅ 채널 배치 처리 성공');
      console.log(`   - 총 동영상: ${channelResult.data.total}개`);
      console.log(`   - 성공: ${channelResult.data.processed}개`);
      console.log(`   - 실패: ${channelResult.data.failed}개`);
    } else {
      console.log('   ❌ 채널 배치 처리 실패');
      console.log(`   - 오류: ${channelResult.data?.error || channelResult.error}`);
    }
    console.log('');
  } else {
    console.log('5. 채널 배치 처리 테스트 (건너뜀)');
    console.log('   💡 TEST_CHANNEL_URL 환경 변수를 설정하면 테스트할 수 있습니다.');
    console.log('');
  }
  
  // 6. 재생목록 배치 처리 테스트 (선택사항)
  const testPlaylistUrl = process.env.TEST_PLAYLIST_URL;
  if (testPlaylistUrl) {
    console.log('6. 재생목록 배치 처리 테스트...');
    console.log(`   재생목록 URL: ${testPlaylistUrl}`);
    console.log('   ⚠️  이 테스트는 시간이 오래 걸릴 수 있습니다.\n');
    
    const playlistResult = await testEndpoint('POST', '/api/batch/playlist/sync', {
      playlistUrl: testPlaylistUrl,
      keyword: process.env.TEST_KEYWORD || null,
      maxVideos: parseInt(process.env.TEST_MAX_VIDEOS || '1'),
      autoIndex: false,
      delayBetweenVideos: 2000
    });
    
    if (playlistResult.ok && playlistResult.data.success) {
      console.log('   ✅ 재생목록 배치 처리 성공');
      console.log(`   - 총 동영상: ${playlistResult.data.total}개`);
      console.log(`   - 성공: ${playlistResult.data.processed}개`);
      console.log(`   - 실패: ${playlistResult.data.failed}개`);
    } else {
      console.log('   ❌ 재생목록 배치 처리 실패');
      console.log(`   - 오류: ${playlistResult.data?.error || playlistResult.error}`);
    }
    console.log('');
  } else {
    console.log('6. 재생목록 배치 처리 테스트 (건너뜀)');
    console.log('   💡 TEST_PLAYLIST_URL 환경 변수를 설정하면 테스트할 수 있습니다.');
    console.log('');
  }
  
  // 7. 검색 API 테스트
  console.log('7. 하이브리드 RAG 검색 테스트...');
  const searchResult = await testEndpoint('POST', '/api/search', {
    query: '사랑',
    top: 5
  });
  
  if (searchResult.ok && searchResult.data.success) {
    console.log('   ✅ 검색 성공');
    console.log(`   - 검색 결과: ${searchResult.data.results?.length || 0}개`);
    if (searchResult.data.results && searchResult.data.results.length > 0) {
      console.log(`   - 첫 번째 결과: "${searchResult.data.results[0].chunkText?.substring(0, 50)}..."`);
    }
  } else {
    console.log('   ⚠️  검색 실패 또는 결과 없음');
    console.log(`   - 오류: ${searchResult.data?.error || '결과 없음'}`);
  }
  console.log('');
  
  console.log('=== 테스트 완료 ===');
  console.log('\n💡 전체 파이프라인 테스트:');
  console.log('   1. ✅ 서버 연결');
  console.log('   2. ✅ API 키 확인');
  console.log('   3. ✅ 단일 동영상 처리 (전체 파이프라인)');
  console.log('   4. ✅ 배치 처리 API (채널/재생목록)');
  console.log('   5. ✅ 하이브리드 RAG 검색');
  console.log('\n📝 사용 방법:');
  console.log('   - 관리자 페이지에서 "배치 처리" 탭 사용');
  console.log('   - 채널 URL 또는 재생목록 URL 입력');
  console.log('   - 키워드 필터링 (선택사항)');
  console.log('   - 배치 처리 시작');
}

testBatchPipeline().catch(error => {
  console.error('테스트 실행 오류:', error);
  process.exit(1);
});
