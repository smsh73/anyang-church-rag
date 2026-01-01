import { youtubeConfig } from '../config/youtubeConfig.js';

/**
 * YouTube 비디오 정보 가져오기
 * @param {string} videoId - 비디오 ID
 * @returns {Promise<Object>} 비디오 정보
 */
async function getVideoInfo(videoId) {
  if (!youtubeConfig.apiKey) {
    // API 키가 없으면 기본 정보만 반환
    return {
      title: '',
      publishedAt: null
    };
  }
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${youtubeConfig.apiKey}&part=snippet`
    );
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      return {
        title: data.items[0].snippet.title,
        publishedAt: data.items[0].snippet.publishedAt
      };
    }
  } catch (error) {
    console.error('Failed to fetch video info:', error);
  }
  
  return {
    title: '',
    publishedAt: null
  };
}

/**
 * 메타데이터 추출
 * @param {string} videoId - 비디오 ID
 * @param {string} videoTitle - 비디오 제목 (선택)
 * @returns {Promise<Object>} 메타데이터
 */
export async function extractMetadata(videoId, videoTitle = null) {
  const videoInfo = await getVideoInfo(videoId);
  const title = videoTitle || videoInfo.title;
  
  const metadata = {
    videoId,
    videoTitle: title,
    serviceType: null, // '주일예배' | '부흥회' | '신년특별새벽기도회'
    serviceDate: null, // YYYY-MM-DD
    uploadDate: videoInfo.publishedAt ? new Date(videoInfo.publishedAt).toISOString().split('T')[0] : null
  };
  
  // 예배 유형 추출
  if (title.includes('주일예배')) {
    metadata.serviceType = '주일예배';
  } else if (title.includes('부흥회')) {
    metadata.serviceType = '부흥회';
  } else if (title.includes('신년특별새벽기도회') || title.includes('신년특별 새벽기도회')) {
    metadata.serviceType = '신년특별새벽기도회';
  }
  
  // 날짜 추출 (정규표현식)
  // "2024년 1월 7일" 형식
  const dateMatch1 = title.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (dateMatch1) {
    const [, year, month, day] = dateMatch1;
    metadata.serviceDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } else {
    // "2024-01-07" 형식
    const dateMatch2 = title.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (dateMatch2) {
      metadata.serviceDate = dateMatch2[0];
    } else {
      // 업로드 날짜를 기본값으로 사용
      metadata.serviceDate = metadata.uploadDate;
    }
  }
  
  return metadata;
}
