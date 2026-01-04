/**
 * YouTube Data API v3를 사용한 자막 추출
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * YouTube Data API를 사용하여 자막 목록 가져오기
 */
export async function getCaptionsList(videoId) {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key is not configured');
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/captions`, {
      params: {
        part: 'snippet',
        videoId: videoId,
        key: YOUTUBE_API_KEY
      }
    });

    return response.data.items || [];
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error('YouTube API quota exceeded or access denied');
    } else if (error.response?.status === 404) {
      throw new Error('Video not found or captions not available');
    }
    throw new Error(`YouTube API error: ${error.message}`);
  }
}

/**
 * YouTube Data API를 사용하여 자막 다운로드
 */
export async function downloadCaption(captionId, language = 'ko') {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key is not configured');
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/captions/${captionId}`, {
      params: {
        tfmt: 'srt', // SRT 형식
        key: YOUTUBE_API_KEY
      },
      responseType: 'text'
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error('YouTube API quota exceeded or access denied');
    } else if (error.response?.status === 404) {
      throw new Error('Caption not found');
    }
    throw new Error(`YouTube API error: ${error.message}`);
  }
}

/**
 * SRT 형식 자막을 파싱하여 표준 형식으로 변환
 */
export function parseSRT(srtText, startSeconds = null, endSeconds = null) {
  const transcript = [];
  const blocks = srtText.split(/\n\s*\n/).filter(block => block.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // 시간 정보 파싱 (예: "00:00:12,000 --> 00:00:15,000")
    const timeLine = lines[1];
    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    
    if (!timeMatch) continue;

    const startTime = parseInt(timeMatch[1]) * 3600 + 
                     parseInt(timeMatch[2]) * 60 + 
                     parseInt(timeMatch[3]) + 
                     parseInt(timeMatch[4]) / 1000;
    const endTime = parseInt(timeMatch[5]) * 3600 + 
                   parseInt(timeMatch[6]) * 60 + 
                   parseInt(timeMatch[7]) + 
                   parseInt(timeMatch[8]) / 1000;

    // 시간 구간 필터링
    if (startSeconds !== null && endTime < startSeconds) continue;
    if (endSeconds !== null && startTime > endSeconds) continue;

    // 텍스트 추출
    const text = lines.slice(2).join(' ').trim();

    if (text) {
      transcript.push({
        text: text,
        offset: Math.floor(startTime * 1000), // 밀리초
        duration: Math.floor((endTime - startTime) * 1000)
      });
    }
  }

  return transcript;
}

/**
 * YouTube Data API를 사용하여 자막 추출 (한국어 우선)
 */
export async function extractCaptionsWithAPI(videoId, startSeconds = null, endSeconds = null) {
  if (!YOUTUBE_API_KEY) {
    console.log('YouTube Data API key not configured, skipping API method');
    return null; // API 키가 없으면 null 반환
  }

  try {
    console.log(`Fetching captions list for video ${videoId} using YouTube Data API...`);
    // 자막 목록 가져오기
    const captionsList = await getCaptionsList(videoId);
    
    console.log(`Found ${captionsList.length} caption(s) for video ${videoId}`);
    
    if (captionsList.length === 0) {
      console.log('No captions available via YouTube Data API');
      return null;
    }

    // 한국어 자막 찾기 (우선)
    let caption = captionsList.find(c => 
      c.snippet.language === 'ko' || 
      c.snippet.language === 'ko-KR' ||
      c.snippet.language.startsWith('ko')
    );

    // 한국어가 없으면 첫 번째 자막 사용
    if (!caption) {
      caption = captionsList[0];
      console.log(`Using caption in language: ${caption.snippet.language}`);
    } else {
      console.log(`Using Korean caption: ${caption.snippet.language}`);
    }

    // 자막 다운로드
    console.log(`Downloading caption ${caption.id}...`);
    const srtText = await downloadCaption(caption.id);
    
    // SRT 파싱
    console.log(`Parsing SRT caption (${srtText.length} characters)...`);
    const transcript = parseSRT(srtText, startSeconds, endSeconds);
    
    console.log(`✅ Successfully extracted ${transcript.length} segments via YouTube Data API`);
    return transcript;
  } catch (error) {
    console.warn('YouTube Data API caption extraction failed:', error.message);
    console.warn('Error details:', {
      videoId,
      errorType: error.constructor.name,
      statusCode: error.response?.status,
      statusText: error.response?.statusText
    });
    return null; // 실패해도 null 반환 (다른 방법 시도)
  }
}
