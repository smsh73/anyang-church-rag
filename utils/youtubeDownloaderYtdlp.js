/**
 * yt-dlp를 사용한 YouTube 오디오 다운로드 (ytdl-core 대안)
 * Python yt-dlp를 child_process로 실행
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, '../temp');

fs.ensureDirSync(tempDir);

/**
 * yt-dlp로 YouTube 오디오 다운로드
 * @param {string} videoId - 비디오 ID
 * @param {number} startTime - 시작 시간 (초)
 * @param {number} endTime - 종료 시간 (초)
 * @returns {Promise<string>} 오디오 파일 경로
 */
export async function downloadAudioWithYtdlp(videoId, startTime = null, endTime = null) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(tempDir, `${videoId}_${Date.now()}.mp3`);
  
  try {
    // yt-dlp 명령 구성
    // -x: 오디오만 추출
    // --audio-format mp3: MP3 형식
    // --audio-quality 0: 최고 품질
    // --no-playlist: 플레이리스트 무시
    // --extract-flat: 빠른 다운로드
    let command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-playlist --no-warnings`;
    
    // 시간 구간 지정
    // --download-sections는 일부 비디오에서 작동하지 않을 수 있으므로
    // 전체 다운로드 후 FFmpeg로 구간 추출하는 것이 더 안정적
    const outputPathNoExt = outputPath.replace(/\.mp3$/, '');
    const tempOutputPath = `${outputPathNoExt}_full.%(ext)s`;
    command += ` -o "${tempOutputPath}" "${videoUrl}"`;
    
    console.log(`Executing yt-dlp command: ${command}`);
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: 600000, // 10분 타임아웃
      maxBuffer: 10 * 1024 * 1024 // 10MB 버퍼
    });
    
    if (stderr && !stderr.includes('WARNING') && !stderr.includes('DeprecationWarning')) {
      console.warn('yt-dlp stderr:', stderr);
    }
    
    // 출력 파일 확인 (yt-dlp는 확장자를 자동 추가)
    let fullAudioPath = null;
    const possibleExtensions = ['mp3', 'm4a', 'webm', 'opus', 'ogg'];
    
    for (const ext of possibleExtensions) {
      const testPath = `${outputPathNoExt}_full.${ext}`;
      if (fs.existsSync(testPath)) {
        fullAudioPath = testPath;
        break;
      }
    }
    
    // 확장자 없이 찾기
    if (!fullAudioPath) {
      const files = fs.readdirSync(tempDir);
      const matchingFile = files.find(f => f.includes('_full.') && f.startsWith(path.basename(outputPathNoExt)));
      if (matchingFile) {
        fullAudioPath = path.join(tempDir, matchingFile);
      }
    }
    
    if (!fullAudioPath || !fs.existsSync(fullAudioPath)) {
      throw new Error(`Downloaded file not found. Expected: ${outputPathNoExt}_full.*`);
    }
    
    // 시간 구간이 지정된 경우 FFmpeg로 구간 추출
    if (startTime !== null || endTime !== null) {
      console.log(`Extracting time segment: ${startTime || 0}s - ${endTime || 'end'}`);
      await new Promise((resolve, reject) => {
        let ffmpegCommand = ffmpeg(fullAudioPath)
          .audioCodec('libmp3lame')
          .format('mp3');
        
        if (startTime !== null) {
          ffmpegCommand = ffmpegCommand.setStartTime(startTime);
        }
        if (endTime !== null && startTime !== null) {
          const duration = endTime - startTime;
          ffmpegCommand = ffmpegCommand.setDuration(duration);
        }
        
        ffmpegCommand
          .on('end', () => {
            // 원본 파일 삭제
            try {
              fs.removeSync(fullAudioPath);
            } catch (e) {
              console.warn('Failed to remove temp file:', e.message);
            }
            resolve();
          })
          .on('error', reject)
          .save(outputPath);
      });
      
      console.log(`Audio segment extracted successfully: ${outputPath}`);
      return outputPath;
    }
    
    // MP3가 아니면 FFmpeg로 변환
    if (!fullAudioPath.endsWith('.mp3')) {
      console.log(`Converting ${path.extname(fullAudioPath)} to MP3...`);
      await new Promise((resolve, reject) => {
        ffmpeg(fullAudioPath)
          .audioCodec('libmp3lame')
          .format('mp3')
          .on('end', () => {
            fs.removeSync(fullAudioPath); // 원본 파일 삭제
            resolve();
          })
          .on('error', reject)
          .save(outputPath);
      });
      console.log(`Audio converted successfully: ${outputPath}`);
      return outputPath;
    }
    
    // 이미 MP3이고 구간 추출이 필요 없으면 파일명만 변경
    if (fullAudioPath !== outputPath) {
      fs.moveSync(fullAudioPath, outputPath);
    }
    
    console.log(`Audio downloaded successfully: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('yt-dlp download error:', error);
    throw new Error(`yt-dlp download failed: ${error.message}`);
  }
}

/**
 * 초를 HH:MM:SS 형식으로 변환
 */
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * yt-dlp 설치 확인
 */
export async function checkYtdlpAvailable() {
  try {
    const { stdout } = await execAsync('yt-dlp --version', { timeout: 5000 });
    return { available: true, version: stdout.trim() };
  } catch (error) {
    return { available: false, error: error.message };
  }
}
