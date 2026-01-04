import ytdl from 'ytdl-core';
import ytdlDistube from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadAudioWithYtdlp, checkYtdlpAvailable } from './youtubeDownloaderYtdlp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tempDir = path.join(__dirname, '../temp');

// temp 디렉토리 생성
fs.ensureDirSync(tempDir);

/**
 * YouTube 비디오 ID 추출
 * @param {string} url - YouTube URL
 * @returns {string} 비디오 ID
 */
export function extractVideoId(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid YouTube URL: URL is required');
  }
  
  // URL 정규화 (공백 제거)
  const normalizedUrl = url.trim();
  
  const patterns = [
    // 표준 YouTube URL
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    // 짧은 URL
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    // 직접 비디오 ID (11자리)
    /^([a-zA-Z0-9_-]{11})$/,
    // URL에 포함된 비디오 ID
    /[?&]v=([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern);
    if (match && match[1] && match[1].length === 11) {
      return match[1];
    }
  }
  
  throw new Error(`Invalid YouTube URL: Could not extract video ID from "${normalizedUrl}"`);
}

/**
 * YouTube 오디오 다운로드
 * @param {string} videoId - 비디오 ID
 * @param {number} startTime - 시작 시간 (초)
 * @param {number} endTime - 종료 시간 (초)
 * @returns {Promise<string>} 오디오 파일 경로
 */
export async function downloadAudio(videoId, startTime = null, endTime = null) {
  const outputPath = path.join(tempDir, `${videoId}_${Date.now()}.mp3`);
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // 먼저 yt-dlp 시도 (더 안정적)
  try {
    const ytdlpCheck = await checkYtdlpAvailable();
    if (ytdlpCheck.available) {
      console.log('Using yt-dlp for audio download...');
      try {
        const ytdlpPath = await downloadAudioWithYtdlp(videoId, startTime, endTime);
        // yt-dlp는 이미 구간이 추출된 파일을 반환하므로 그대로 사용
        return ytdlpPath;
      } catch (ytdlpError) {
        console.warn('yt-dlp failed, falling back to ytdl-core:', ytdlpError.message);
        // yt-dlp 실패 시 ytdl-core로 fallback
      }
    }
  } catch (checkError) {
    console.warn('yt-dlp check failed, using ytdl-core:', checkError.message);
  }
  
  // ytdl-core 사용 (fallback)
  return new Promise((resolve, reject) => {
    let stream;
    let streamError = null;
    
    try {
      // 오디오 스트림 생성 (ytdl-core 시도)
      try {
        stream = ytdl(videoUrl, {
          quality: 'highestaudio',
          filter: 'audioonly',
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          }
        });
      } catch (ytdlError) {
        // ytdl-core 실패 시 @distube/ytdl-core 시도
        console.log('ytdl-core failed, trying @distube/ytdl-core...');
        console.log('Error:', ytdlError.message);
        
        try {
          stream = ytdlDistube(videoUrl, {
            quality: 'highestaudio',
            filter: 'audioonly',
            requestOptions: {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            }
          });
          console.log('Using @distube/ytdl-core');
        } catch (distubeError) {
          // 모든 방법 실패 시 yt-dlp 재시도
          console.error('All ytdl methods failed, trying yt-dlp as last resort...');
          checkYtdlpAvailable().then(ytdlpCheck => {
            if (ytdlpCheck.available) {
              downloadAudioWithYtdlp(videoId, startTime, endTime)
                .then(resolve)
                .catch(reject);
            } else {
              reject(new Error(`All download methods failed. ytdl-core: ${ytdlError.message}, distube: ${distubeError.message}, yt-dlp: not available`));
            }
          }).catch(() => {
            reject(new Error(`All download methods failed. ytdl-core: ${ytdlError.message}, distube: ${distubeError.message}`));
          });
          return;
        }
      }
      
      // 스트림 에러 핸들링 (비동기 처리)
      stream.on('error', async (err) => {
        streamError = err;
        let errorMessage = `YouTube 다운로드 실패: ${err.message}`;
        
        if (err.statusCode === 410) {
          errorMessage = `YouTube 비디오를 다운로드할 수 없습니다 (410 Gone). 비디오가 삭제되었거나 접근이 제한되었을 수 있습니다.`;
        } else if (err.statusCode === 403) {
          errorMessage = `YouTube 비디오 접근이 거부되었습니다 (403 Forbidden). 비디오가 지역 제한 또는 연령 제한이 있을 수 있습니다.`;
        } else if (err.statusCode === 404) {
          errorMessage = `YouTube 비디오를 찾을 수 없습니다 (404 Not Found).`;
        }
        
        // yt-dlp로 재시도 (비동기 처리)
        console.log('Stream error detected, trying yt-dlp as fallback...');
        try {
          const ytdlpCheck = await checkYtdlpAvailable();
          if (ytdlpCheck.available) {
            console.log('yt-dlp is available, using it as fallback...');
            try {
              const ytdlpPath = await downloadAudioWithYtdlp(videoId, startTime, endTime);
              console.log('✅ yt-dlp fallback succeeded');
              resolve(ytdlpPath);
              return;
            } catch (ytdlpError) {
              console.error('yt-dlp fallback also failed:', ytdlpError.message);
              reject(new Error(`${errorMessage} (yt-dlp fallback also failed: ${ytdlpError.message})`));
              return;
            }
          } else {
            console.warn('yt-dlp not available for fallback');
            reject(new Error(errorMessage));
            return;
          }
        } catch (checkError) {
          console.error('yt-dlp check failed during fallback:', checkError.message);
          reject(new Error(errorMessage));
          return;
        }
      });
      
      let ffmpegCommand = ffmpeg(stream)
        .audioCodec('libmp3lame')
        .format('mp3');
      
      // 시간 구간 지정
      if (startTime !== null) {
        ffmpegCommand = ffmpegCommand.setStartTime(startTime);
      }
      if (endTime !== null && startTime !== null) {
        const duration = endTime - startTime;
        ffmpegCommand = ffmpegCommand.setDuration(duration);
      }
      
      ffmpegCommand
        .on('start', (commandLine) => {
          console.log('FFmpeg 명령:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`다운로드 진행률: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          if (!streamError) {
            resolve(outputPath);
          }
        })
        .on('error', (err) => {
          if (!streamError) {
            reject(new Error(`FFmpeg 오류: ${err.message}`));
          }
        })
        .save(outputPath);
    } catch (error) {
      reject(new Error(`YouTube 다운로드 초기화 실패: ${error.message}`));
    }
  });
}

/**
 * 임시 파일 삭제
 * @param {string} filePath - 파일 경로
 */
export async function cleanupTempFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      await fs.remove(filePath);
    }
  } catch (error) {
    console.error(`Failed to cleanup temp file: ${filePath}`, error);
  }
}
