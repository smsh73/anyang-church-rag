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
    
    // 오디오 스트림 생성
    const stream = ytdl(videoUrl, {
      quality: 'highestaudio',
      filter: 'audioonly'
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
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .save(outputPath);
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
