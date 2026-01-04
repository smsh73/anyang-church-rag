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
    let command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-playlist`;
    
    // 시간 구간 지정 (yt-dlp는 --download-sections 사용)
    if (startTime !== null && endTime !== null) {
      const startTimeStr = formatTime(startTime);
      const endTimeStr = formatTime(endTime);
      command += ` --download-sections "*${startTimeStr}-${endTimeStr}"`;
    } else if (startTime !== null) {
      const startTimeStr = formatTime(startTime);
      command += ` --download-sections "*${startTimeStr}-"`;
    }
    
    // 출력 파일 경로 (확장자 없이 지정하면 자동 추가)
    const outputPathNoExt = outputPath.replace(/\.mp3$/, '');
    command += ` -o "${outputPathNoExt}.%(ext)s" "${videoUrl}"`;
    
    console.log(`Executing yt-dlp command: ${command}`);
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: 600000, // 10분 타임아웃
      maxBuffer: 10 * 1024 * 1024 // 10MB 버퍼
    });
    
    if (stderr && !stderr.includes('WARNING')) {
      console.warn('yt-dlp stderr:', stderr);
    }
    
    // 출력 파일 확인 (yt-dlp는 확장자를 자동 추가)
    // outputPathNoExt.mp3 또는 outputPathNoExt.m4a 등으로 저장될 수 있음
    let finalPath = null;
    const possibleExtensions = ['mp3', 'm4a', 'webm', 'opus'];
    
    for (const ext of possibleExtensions) {
      const testPath = `${outputPathNoExt}.${ext}`;
      if (fs.existsSync(testPath)) {
        finalPath = testPath;
        break;
      }
    }
    
    // 확장자 없이 찾기
    if (!finalPath) {
      const files = fs.readdirSync(tempDir);
      const matchingFile = files.find(f => f.startsWith(path.basename(outputPathNoExt)));
      if (matchingFile) {
        finalPath = path.join(tempDir, matchingFile);
      }
    }
    
    if (!finalPath || !fs.existsSync(finalPath)) {
      throw new Error(`Downloaded file not found. Expected: ${outputPathNoExt}.*`);
    }
    
    // MP3가 아니면 FFmpeg로 변환 필요
    if (!finalPath.endsWith('.mp3')) {
      console.log(`Converting ${path.extname(finalPath)} to MP3...`);
      const mp3Path = outputPath;
      await new Promise((resolve, reject) => {
        ffmpeg(finalPath)
          .audioCodec('libmp3lame')
          .format('mp3')
          .on('end', () => {
            fs.removeSync(finalPath); // 원본 파일 삭제
            resolve();
          })
          .on('error', reject)
          .save(mp3Path);
      });
      finalPath = mp3Path;
    }
    
    console.log(`Audio downloaded successfully: ${finalPath}`);
    return finalPath;
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
