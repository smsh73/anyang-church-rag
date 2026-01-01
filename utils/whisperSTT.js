import { pipeline } from '@xenova/transformers';
import fs from 'fs-extra';

let transcriber = null;

/**
 * Whisper 모델 초기화
 */
async function initializeTranscriber() {
  if (!transcriber) {
    transcriber = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-small',
      { device: 'cpu' }
    );
  }
  return transcriber;
}

/**
 * 오디오 파일을 텍스트로 변환
 * @param {string} audioPath - 오디오 파일 경로
 * @param {string} language - 언어 코드 (예: 'ko')
 * @returns {Promise<Array>} 타임스탬프와 텍스트 배열
 */
export async function transcribeAudio(audioPath, language = 'ko') {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }
  
  const model = await initializeTranscriber();
  
  try {
    // 오디오 파일을 읽어서 변환
    // 참고: @xenova/transformers는 직접 파일 경로를 지원하지 않으므로
    // 오디오를 버퍼로 읽어서 처리해야 할 수 있습니다.
    // 실제 구현에서는 오디오를 적절한 형식으로 변환해야 합니다.
    
    const result = await model(audioPath, {
      language: language,
      return_timestamps: true
    });
    
    // 결과를 표준 형식으로 변환
    const transcript = [];
    if (result.chunks) {
      for (const chunk of result.chunks) {
        transcript.push({
          text: chunk.text,
          offset: Math.floor(chunk.timestamp[0] * 1000), // 밀리초
          duration: Math.floor((chunk.timestamp[1] - chunk.timestamp[0]) * 1000)
        });
      }
    } else {
      // chunks가 없는 경우 전체 텍스트를 하나로
      transcript.push({
        text: result.text || '',
        offset: 0,
        duration: 0
      });
    }
    
    return transcript;
  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }
}
