import dotenv from 'dotenv';
import { getApiKey } from '../services/aiKeyManager.js';

dotenv.config();

/**
 * YouTube API 키 가져오기 (우선순위: 데이터베이스 > 환경 변수)
 */
export async function getYouTubeApiKey() {
  try {
    // 1. 데이터베이스에서 키 가져오기 (우선)
    const dbKey = await getApiKey('youtube');
    if (dbKey && dbKey.api_key) {
      return dbKey.api_key;
    }
  } catch (error) {
    console.warn('Failed to get YouTube API key from database:', error.message);
  }
  
  // 2. 환경 변수에서 키 가져오기 (fallback)
  return process.env.YOUTUBE_API_KEY;
}

// 동기식 접근을 위한 설정 객체 (비동기 함수 사용 권장)
export const youtubeConfig = {
  // 비동기로 키를 가져오려면 getYouTubeApiKey() 함수 사용
  getApiKey: getYouTubeApiKey
};
