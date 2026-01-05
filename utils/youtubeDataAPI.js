/**
 * YouTube Data API v3를 사용한 자막 추출
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { getApiKey } from '../services/aiKeyManager.js';

dotenv.config();

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * YouTube API 키 가져오기 (우선순위: 데이터베이스 > 환경 변수)
 */
async function getYouTubeApiKey() {
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

/**
 * YouTube Data API를 사용하여 자막 목록 가져오기
 */
export async function getCaptionsList(videoId) {
  const apiKey = await getYouTubeApiKey();
  if (!apiKey) {
    throw new Error('YouTube API key is not configured');
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/captions`, {
      params: {
        part: 'snippet',
        videoId: videoId,
        key: apiKey
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
  const apiKey = await getYouTubeApiKey();
  if (!apiKey) {
    throw new Error('YouTube API key is not configured');
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/captions/${captionId}`, {
      params: {
        tfmt: 'srt', // SRT 형식
        key: apiKey
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
  const apiKey = await getYouTubeApiKey();
  if (!apiKey) {
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

/**
 * URL에서 채널 ID 추출
 */
export function extractChannelId(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid YouTube channel URL: URL is required');
  }
  
  const normalizedUrl = url.trim();
  
  // 채널 URL 패턴들
  const patterns = [
    /(?:youtube\.com\/channel\/)([^\/\n?#]+)/,
    /(?:youtube\.com\/c\/)([^\/\n?#]+)/,
    /(?:youtube\.com\/user\/)([^\/\n?#]+)/,
    /(?:youtube\.com\/@)([^\/\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // 직접 채널 ID (24자리)
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(normalizedUrl)) {
    return normalizedUrl;
  }
  
  throw new Error(`Invalid YouTube channel URL: Could not extract channel ID from "${normalizedUrl}"`);
}

/**
 * URL에서 재생목록 ID 추출
 */
export function extractPlaylistId(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid YouTube playlist URL: URL is required');
  }
  
  const normalizedUrl = url.trim();
  
  // 재생목록 URL 패턴
  const patterns = [
    /(?:youtube\.com\/playlist\?list=)([^&\n?#]+)/,
    /[?&]list=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // 직접 재생목록 ID (34자리)
  if (/^PL[a-zA-Z0-9_-]{32}$/.test(normalizedUrl)) {
    return normalizedUrl;
  }
  
  throw new Error(`Invalid YouTube playlist URL: Could not extract playlist ID from "${normalizedUrl}"`);
}

/**
 * 채널 ID로 채널 정보 가져오기
 */
export async function getChannelInfo(channelIdOrUrl) {
  const apiKey = await getYouTubeApiKey();
  if (!apiKey) {
    throw new Error('YouTube API key is not configured');
  }

  let channelId = channelIdOrUrl;
  let isUsername = false;
  
  // URL인 경우 채널 ID 추출
  if (channelIdOrUrl.includes('youtube.com') || channelIdOrUrl.includes('youtu.be')) {
    try {
      const extracted = extractChannelId(channelIdOrUrl);
      // @username 형식인지 확인
      if (extracted.startsWith('@') || (!extracted.startsWith('UC') && extracted.length !== 24)) {
        isUsername = true;
        channelId = extracted.replace('@', '');
      } else {
        channelId = extracted;
      }
    } catch (error) {
      // URL이 아닌 경우 그대로 사용
    }
  } else if (channelIdOrUrl.startsWith('@')) {
    // 직접 @username 형식
    isUsername = true;
    channelId = channelIdOrUrl.replace('@', '');
  }

  try {
    const params = {
      part: 'snippet,contentDetails',
      key: apiKey
    };

    // @username 형식인 경우 forUsername 사용, 아니면 id 사용
    if (isUsername) {
      params.forUsername = channelId;
    } else {
      params.id = channelId;
    }

    const response = await axios.get(`${YOUTUBE_API_BASE}/channels`, { params });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0];
    }
    
    // forUsername으로 찾지 못한 경우, search API로 재시도
    if (isUsername) {
      const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
        params: {
          part: 'snippet',
          q: channelId,
          type: 'channel',
          maxResults: 1,
          key: apiKey
        }
      });

      if (searchResponse.data.items && searchResponse.data.items.length > 0) {
        const channelIdFromSearch = searchResponse.data.items[0].id.channelId;
        // 찾은 채널 ID로 다시 정보 가져오기
        const channelInfoResponse = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
          params: {
            part: 'snippet,contentDetails',
            id: channelIdFromSearch,
            key: apiKey
          }
        });

        if (channelInfoResponse.data.items && channelInfoResponse.data.items.length > 0) {
          return channelInfoResponse.data.items[0];
        }
      }
    }
    
    throw new Error('Channel not found');
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error('YouTube API quota exceeded or access denied');
    } else if (error.response?.status === 404) {
      throw new Error('Channel not found');
    }
    throw new Error(`YouTube API error: ${error.message}`);
  }
}

/**
 * 채널의 동영상 목록 가져오기 (최신순)
 */
export async function getChannelVideos(channelIdOrUrl, maxResults = 50, pageToken = null, keyword = null) {
  const apiKey = await getYouTubeApiKey();
  if (!apiKey) {
    throw new Error('YouTube API key is not configured');
  }

  let channelId = channelIdOrUrl;
  // URL인 경우 채널 ID 추출
  if (channelIdOrUrl.includes('youtube.com') || channelIdOrUrl.includes('youtu.be')) {
    try {
      channelId = extractChannelId(channelIdOrUrl);
    } catch (error) {
      // URL이 아닌 경우 그대로 사용
    }
  }

  try {
    // 채널 정보 가져오기
    const channelInfo = await getChannelInfo(channelId);
    const uploadsPlaylistId = channelInfo.contentDetails?.relatedPlaylists?.uploads;
    
    if (!uploadsPlaylistId) {
      throw new Error('Channel uploads playlist not found');
    }

    // 재생목록의 동영상 가져오기
    return await getPlaylistVideos(uploadsPlaylistId, maxResults, pageToken, keyword);
  } catch (error) {
    throw new Error(`Failed to get channel videos: ${error.message}`);
  }
}

/**
 * 재생목록의 동영상 목록 가져오기
 */
export async function getPlaylistVideos(playlistIdOrUrl, maxResults = 50, pageToken = null, keyword = null) {
  const apiKey = await getYouTubeApiKey();
  if (!apiKey) {
    throw new Error('YouTube API key is not configured');
  }

  let playlistId = playlistIdOrUrl;
  // URL인 경우 재생목록 ID 추출
  if (playlistIdOrUrl.includes('youtube.com') || playlistIdOrUrl.includes('youtu.be')) {
    try {
      playlistId = extractPlaylistId(playlistIdOrUrl);
    } catch (error) {
      // URL이 아닌 경우 그대로 사용
    }
  }

  try {
    const params = {
      part: 'snippet,contentDetails',
      playlistId: playlistId,
      maxResults: Math.min(maxResults, 50), // 최대 50개
      key: apiKey,
      order: 'date' // 최신순
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const response = await axios.get(`${YOUTUBE_API_BASE}/playlistItems`, { params });

    let videos = (response.data.items || []).map(item => ({
      videoId: item.contentDetails.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails?.default?.url,
      channelTitle: item.snippet.channelTitle
    }));

    // 키워드 필터링
    if (keyword) {
      const keywordLower = keyword.toLowerCase();
      videos = videos.filter(video => 
        video.title.toLowerCase().includes(keywordLower) ||
        (video.description && video.description.toLowerCase().includes(keywordLower))
      );
    }

    return {
      videos,
      nextPageToken: response.data.nextPageToken,
      totalResults: response.data.pageInfo?.totalResults || videos.length
    };
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error('YouTube API quota exceeded or access denied');
    } else if (error.response?.status === 404) {
      throw new Error('Playlist not found');
    }
    throw new Error(`YouTube API error: ${error.message}`);
  }
}

/**
 * 모든 페이지의 동영상 가져오기 (재귀적으로)
 */
export async function getAllPlaylistVideos(playlistIdOrUrl, keyword = null, maxVideos = null) {
  let allVideos = [];
  let pageToken = null;
  let hasMore = true;

  while (hasMore) {
    const result = await getPlaylistVideos(
      playlistIdOrUrl, 
      maxVideos ? Math.min(50, maxVideos - allVideos.length) : 50,
      pageToken,
      keyword
    );

    allVideos = allVideos.concat(result.videos);
    pageToken = result.nextPageToken;
    hasMore = !!pageToken;

    // 최대 개수 제한
    if (maxVideos && allVideos.length >= maxVideos) {
      allVideos = allVideos.slice(0, maxVideos);
      hasMore = false;
    }
  }

  return allVideos;
}

/**
 * 채널의 모든 동영상 가져오기 (재귀적으로)
 */
export async function getAllChannelVideos(channelIdOrUrl, keyword = null, maxVideos = null) {
  let channelId = channelIdOrUrl;
  // URL인 경우 채널 ID 추출
  if (channelIdOrUrl.includes('youtube.com') || channelIdOrUrl.includes('youtu.be')) {
    try {
      channelId = extractChannelId(channelIdOrUrl);
    } catch (error) {
      // URL이 아닌 경우 그대로 사용
    }
  }

  // 채널 정보 가져오기
  const channelInfo = await getChannelInfo(channelId);
  const uploadsPlaylistId = channelInfo.contentDetails?.relatedPlaylists?.uploads;
  
  if (!uploadsPlaylistId) {
    throw new Error('Channel uploads playlist not found');
  }

  // 재생목록의 모든 동영상 가져오기
  return await getAllPlaylistVideos(uploadsPlaylistId, keyword, maxVideos);
}
