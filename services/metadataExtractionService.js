import { mixtureOfAgents } from './aiService.js';

/**
 * 설교 메타데이터 추출 (AI 사용)
 */
export async function extractSermonMetadata(chunkText, videoMetadata) {
  const prompt = `다음은 교회 설교 원문의 일부입니다. 다음 정보를 추출하여 JSON 형식으로 반환해주세요:
- 설교자 (preacher): 설교를 한 사람의 이름
- 설교주제 (sermon_topic): 설교의 주제나 제목
- 성경말씀 (bible_verse): 인용된 성경 구절 (책명 장:절 형식, 예: "요한복음 3:16")
- 핵심 키워드 (keywords): 설교의 핵심 키워드 3-5개 (배열)

설교 원문:
${chunkText}

JSON 형식:
{
  "preacher": "설교자 이름",
  "sermon_topic": "설교 주제",
  "bible_verse": "성경 구절",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`;

  try {
    const result = await mixtureOfAgents(prompt, {
      providers: ['openai', 'claude'],
      systemPrompt: 'You are an expert at extracting metadata from sermon transcripts. Return only valid JSON.'
    });

    // JSON 파싱
    const jsonMatch = result.primary.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const metadata = JSON.parse(jsonMatch[0]);
      return {
        preacher: metadata.preacher || null,
        sermon_topic: metadata.sermon_topic || null,
        bible_verse: metadata.bible_verse || null,
        keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
        service_date: videoMetadata.serviceDate || null,
        service_type: videoMetadata.serviceType || null
      };
    }
  } catch (error) {
    console.error('Metadata extraction error:', error);
  }

  // 실패 시 기본값 반환
  return {
    preacher: null,
    sermon_topic: null,
    bible_verse: null,
    keywords: [],
    service_date: videoMetadata.serviceDate || null,
    service_type: videoMetadata.serviceType || null
  };
}
