import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { getApiKey } from './aiKeyManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, '../temp');

/**
 * Podcast 오디오 생성 (ElevenLabs 사용)
 */
export async function generatePodcastAudio(text, options = {}) {
  const apiKeyData = await getApiKey('elevenlabs');
  if (!apiKeyData) {
    throw new Error('ElevenLabs API key not found');
  }

  const voiceId = options.voiceId || '21m00Tcm4TlvDq8ikWAM'; // 기본 한국어 음성
  const modelId = options.modelId || 'eleven_multilingual_v2';

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: modelId,
        voice_settings: {
          stability: options.stability || 0.5,
          similarity_boost: options.similarityBoost || 0.75
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKeyData.api_key
        },
        responseType: 'arraybuffer'
      }
    );

    // 오디오 파일 저장
    const outputPath = path.join(tempDir, `podcast_${Date.now()}.mp3`);
    await fs.ensureDir(tempDir);
    await fs.writeFile(outputPath, Buffer.from(response.data));

    return {
      filePath: outputPath,
      duration: options.estimatedDuration || 0
    };
  } catch (error) {
    throw new Error(`Podcast generation failed: ${error.message}`);
  }
}

/**
 * 긴 텍스트를 여러 오디오로 분할하여 생성
 */
export async function generateLongPodcastAudio(text, options = {}) {
  const chunkSize = options.chunkSize || 5000; // 문자 단위
  const chunks = [];
  
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }

  const audioFiles = [];
  for (const chunk of chunks) {
    const audio = await generatePodcastAudio(chunk, options);
    audioFiles.push(audio);
  }

  return audioFiles;
}
