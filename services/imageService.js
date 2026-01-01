import axios from 'axios';
import { getApiKey } from './aiKeyManager.js';

/**
 * Nano Banana Pro를 통한 이미지 생성
 * 참고: Nano Banana Pro는 실제 API가 있을 수 있으므로, 여기서는 일반적인 이미지 생성 API 패턴을 따릅니다.
 */
export async function generateImageWithNanoBanana(prompt, options = {}) {
  // Nano Banana Pro API 엔드포인트 (실제 API에 맞게 수정 필요)
  const apiKeyData = await getApiKey('nanobanana');
  if (!apiKeyData) {
    throw new Error('Nano Banana Pro API key not found');
  }

  try {
    const response = await axios.post(
      'https://api.nanobanana.pro/v1/images/generate', // 실제 엔드포인트로 변경 필요
      {
        prompt,
        width: options.width || 1024,
        height: options.height || 1024,
        num_images: options.numImages || 1,
        ...options
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKeyData.api_key}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      images: response.data.images || [response.data.image],
      metadata: response.data.metadata
    };
  } catch (error) {
    // Nano Banana Pro API가 없는 경우, 대체 방법 사용
    console.warn('Nano Banana Pro API not available, using alternative');
    return await generateImageAlternative(prompt, options);
  }
}

/**
 * 대체 이미지 생성 방법 (OpenAI DALL-E 사용)
 */
async function generateImageAlternative(prompt, options = {}) {
  const apiKeyData = await getApiKey('openai');
  if (!apiKeyData) {
    throw new Error('OpenAI API key not found for image generation');
  }

  const response = await axios.post(
    'https://api.openai.com/v1/images/generations',
    {
      model: 'dall-e-3',
      prompt,
      n: options.numImages || 1,
      size: options.size || '1024x1024',
      quality: options.quality || 'standard'
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKeyData.api_key}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return {
    images: response.data.data.map(img => img.url),
    metadata: {
      revised_prompt: response.data.data[0]?.revised_prompt
    }
  };
}
