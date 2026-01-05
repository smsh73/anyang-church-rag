/**
 * YouTube Data API를 사용한 transcripts 추출 테스트
 */

import { extractCaptionsWithAPI } from './utils/youtubeDataAPI.js';
import { getApiKey } from './services/aiKeyManager.js';

async function testYouTubeAPI() {
  console.log('=== YouTube Data API Transcripts 테스트 ===\n');
  
  // YouTube API 키 확인
  console.log('1. YouTube API 키 확인...');
  try {
    const apiKey = await getApiKey('youtube');
    if (apiKey && apiKey.api_key) {
      console.log(`   ✅ API 키 발견 (데이터베이스)`);
      console.log(`   - Provider: ${apiKey.provider}`);
      console.log(`   - Name: ${apiKey.name || 'N/A'}`);
      console.log(`   - Active: ${apiKey.is_active}`);
    } else {
      console.log(`   ⚠️  데이터베이스에 API 키가 없습니다.`);
      if (process.env.YOUTUBE_API_KEY) {
        console.log(`   ✅ 환경 변수에서 API 키 발견`);
      } else {
        console.log(`   ❌ 환경 변수에도 API 키가 없습니다.`);
        console.log(`   💡 API 키를 설정하려면:`);
        console.log(`      1. 관리자 페이지에서 "YouTube Data API" 키 추가`);
        console.log(`      2. 또는 환경 변수 YOUTUBE_API_KEY 설정`);
        return;
      }
    }
    console.log('');
  } catch (error) {
    console.log(`   ⚠️  API 키 확인 실패: ${error.message}`);
    if (process.env.YOUTUBE_API_KEY) {
      console.log(`   ✅ 환경 변수에서 API 키 발견`);
    } else {
      console.log(`   ❌ 환경 변수에도 API 키가 없습니다.`);
      return;
    }
    console.log('');
  }
  
  // 테스트할 YouTube 비디오 ID
  const testVideoId = process.env.TEST_VIDEO_ID || 'dQw4w9WgXcQ'; // 기본값: Rick Astley - Never Gonna Give You Up
  const startSeconds = process.env.TEST_START_SECONDS ? parseInt(process.env.TEST_START_SECONDS) : null;
  const endSeconds = process.env.TEST_END_SECONDS ? parseInt(process.env.TEST_END_SECONDS) : null;
  
  console.log(`2. YouTube 비디오 transcripts 추출 테스트...`);
  console.log(`   - Video ID: ${testVideoId}`);
  if (startSeconds !== null) {
    console.log(`   - 시작 시간: ${startSeconds}초`);
  }
  if (endSeconds !== null) {
    console.log(`   - 종료 시간: ${endSeconds}초`);
  }
  console.log('');
  
  try {
    const transcript = await extractCaptionsWithAPI(testVideoId, startSeconds, endSeconds);
    
    if (transcript && transcript.length > 0) {
      console.log(`   ✅ 성공! ${transcript.length}개의 세그먼트 추출됨`);
      console.log('');
      
      // 첫 5개 세그먼트 출력
      console.log('3. 추출된 transcripts 샘플 (처음 5개):');
      transcript.slice(0, 5).forEach((item, index) => {
        const startTime = Math.floor(item.offset / 1000);
        const endTime = Math.floor((item.offset + item.duration) / 1000);
        console.log(`   ${index + 1}. [${startTime}s - ${endTime}s] ${item.text.substring(0, 60)}${item.text.length > 60 ? '...' : ''}`);
      });
      console.log('');
      
      // 통계
      const totalDuration = transcript.reduce((sum, item) => sum + item.duration, 0);
      const totalText = transcript.map(item => item.text).join(' ');
      console.log('4. 통계:');
      console.log(`   - 총 세그먼트 수: ${transcript.length}개`);
      console.log(`   - 총 시간: ${Math.floor(totalDuration / 1000)}초`);
      console.log(`   - 총 문자 수: ${totalText.length}자`);
      console.log(`   - 평균 세그먼트 길이: ${Math.floor(totalDuration / transcript.length / 1000)}초`);
      console.log('');
      
      console.log('✅ YouTube Data API transcripts 추출 테스트 성공!');
    } else {
      console.log(`   ⚠️  transcripts가 없거나 비어있습니다.`);
      console.log(`   💡 비디오에 자막이 있는지 확인하세요.`);
    }
  } catch (error) {
    console.log(`   ❌ 실패: ${error.message}`);
    console.log('');
    
    if (error.message.includes('not configured')) {
      console.log('💡 해결 방법:');
      console.log('   1. 관리자 페이지에서 "YouTube Data API" 키 추가');
      console.log('   2. 또는 환경 변수 YOUTUBE_API_KEY 설정');
    } else if (error.message.includes('quota exceeded')) {
      console.log('💡 YouTube API 할당량이 초과되었습니다.');
      console.log('   - 일일 할당량: 10,000 units');
      console.log('   - captions.list: 50 units');
      console.log('   - captions.download: 50 units');
    } else if (error.message.includes('not found')) {
      console.log('💡 비디오를 찾을 수 없거나 자막이 없습니다.');
      console.log('   - 다른 비디오 ID로 시도해보세요.');
    }
  }
  
  console.log('\n=== 테스트 완료 ===');
}

testYouTubeAPI().catch(error => {
  console.error('테스트 실행 오류:', error);
  process.exit(1);
});
