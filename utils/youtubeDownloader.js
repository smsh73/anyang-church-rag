import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

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
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // 직접 비디오 ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  throw new Error('Invalid YouTube URL');
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
  
  return new Promise((resolve, reject) => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    let stream;
    let streamError = null;
    
    try {
      // 오디오 스트림 생성
      stream = ytdl(videoUrl, {
        quality: 'highestaudio',
        filter: 'audioonly',
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      });
      
      // 스트림 에러 핸들링
      stream.on('error', (err) => {
        streamError = err;
        let errorMessage = `YouTube 다운로드 실패: ${err.message}`;
        
        if (err.statusCode === 410) {
          errorMessage = `YouTube 비디오를 다운로드할 수 없습니다 (410 Gone). 비디오가 삭제되었거나 접근이 제한되었을 수 있습니다.`;
        } else if (err.statusCode === 403) {
          errorMessage = `YouTube 비디오 접근이 거부되었습니다 (403 Forbidden). 비디오가 지역 제한 또는 연령 제한이 있을 수 있습니다.`;
        } else if (err.statusCode === 404) {
          errorMessage = `YouTube 비디오를 찾을 수 없습니다 (404 Not Found).`;
        }
        
        reject(new Error(errorMessage));
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
