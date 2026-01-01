import { callOpenAI } from './aiService.js';

/**
 * AI 기반 자막 보정
 * @param {Array} transcript - 원본 자막 배열
 * @returns {Promise<Array>} 보정된 자막 배열
 */
export async function correctTranscript(transcript) {
  // 자막 텍스트를 하나로 합치기
  const fullText = transcript.map(item => item.text).join(' ');
  
  const prompt = `다음은 교회 예배 자막입니다. 문법 오류를 수정하고, 불완전한 문장을 완성하여 자연스러운 문장으로 만들어주세요.
원본 자막의 의미와 내용은 그대로 유지하되, 문맥에 맞게 보정해주세요.
설교, 찬양, 기도 등의 교회 예배 컨텍스트를 고려하여 보정해주세요.

자막:
${fullText}

보정된 자막:`;

  try {
    const correctedText = await callOpenAI(
      [
        {
          role: 'system',
          content: '당신은 교회 예배 자막을 보정하는 전문가입니다. 문법 오류를 수정하고 자연스러운 문장으로 만들어주세요.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      {
        temperature: 0.3,
        max_tokens: 4000
      }
    );
    
    // 보정된 텍스트를 원본 구조에 맞게 분할
    // 보정된 텍스트를 문장 단위로 분할
    const correctedSentences = correctedText.split(/[.!?]\s+/).filter(s => s.trim());
    
    // 원본 transcript와 매핑
    // 원본 텍스트를 합쳐서 보정된 텍스트와 비교
    const originalFullText = transcript.map(item => item.text).join(' ');
    
    // 보정된 텍스트를 원본 길이에 맞게 분할 (간단한 방법)
    const correctedTranscript = transcript.map((item, index) => {
      // 보정된 텍스트에서 해당 부분 추출 (비율 기반)
      const startRatio = index / transcript.length;
      const endRatio = (index + 1) / transcript.length;
      const startPos = Math.floor(startRatio * correctedText.length);
      const endPos = Math.floor(endRatio * correctedText.length);
      const correctedSegment = correctedText.substring(startPos, endPos).trim();
      
      return {
        originalText: item.text,
        correctedText: correctedSegment || item.text,
        offset: item.offset,
        duration: item.duration
      };
    });
    
    return {
      correctedTranscript,
      fullCorrectedText: correctedText
    };
  } catch (error) {
    throw new Error(`Correction failed: ${error.message}`);
  }
}
