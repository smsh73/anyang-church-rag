/**
 * 텍스트를 500자 단위로 청킹 (20% 오버랩)
 * @param {Array} paragraphs - 완성된 문단 배열
 * @param {Object} metadata - 메타데이터
 * @param {number} chunkSize - 청크 크기 (기본 500자)
 * @param {number} overlapPercent - 오버랩 비율 (기본 20%)
 * @returns {Array} 청크 배열
 */
export function chunkText(paragraphs, metadata, chunkSize = 500, overlapPercent = 20) {
  const chunks = [];
  const overlapSize = Math.floor(chunkSize * (overlapPercent / 100));
  let currentChunk = '';
  let currentCharCount = 0;
  let chunkIndex = 0;
  let startChar = 0;
  let currentStartOffset = null;
  let overlapText = ''; // 오버랩을 위한 텍스트
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const paragraphText = paragraph.text;
    const paragraphLength = paragraphText.length;
    
    if (!currentStartOffset) {
      currentStartOffset = paragraph.startOffset;
    }
    
    // 현재 청크에 추가하면 초과하는 경우
    if (currentCharCount + paragraphLength > chunkSize && currentChunk) {
      // 현재 청크 저장
      const endChar = startChar + currentCharCount;
      const chunkText = currentChunk.trim();
      
      chunks.push({
        id: `${metadata.videoId}_${chunkIndex}`,
        chunkText,
        metadata: {
          ...metadata,
          chunkIndex,
          startChar,
          endChar,
          startTime: currentStartOffset || 0,
          endTime: paragraph.startOffset
        },
        fullText: formatEmbeddingText(metadata, chunkText)
      });
      
      // 오버랩 텍스트 계산 (마지막 overlapSize 문자)
      overlapText = chunkText.slice(-overlapSize);
      
      // 새 청크 시작 (오버랩 포함)
      currentChunk = overlapText + ' ' + paragraphText + ' ';
      currentCharCount = overlapText.length + 1 + paragraphLength + 1;
      startChar = endChar - overlapSize; // 오버랩만큼 뒤로
      currentStartOffset = paragraph.startOffset;
      chunkIndex++;
    } else {
      currentChunk += paragraphText + ' ';
      currentCharCount += paragraphLength + 1;
    }
  }
  
  // 마지막 청크 처리
  if (currentChunk.trim()) {
    const endChar = startChar + currentCharCount;
    const lastParagraph = paragraphs[paragraphs.length - 1];
    chunks.push({
      id: `${metadata.videoId}_${chunkIndex}`,
      chunkText: currentChunk.trim(),
      metadata: {
        ...metadata,
        chunkIndex,
        startChar,
        endChar,
        startTime: currentStartOffset || lastParagraph.startOffset,
        endTime: lastParagraph.endOffset
      },
      fullText: formatEmbeddingText(metadata, currentChunk.trim())
    });
  }
  
  return chunks;
}

/**
 * 임베딩용 텍스트 포맷팅
 * @param {Object} metadata - 메타데이터
 * @param {string} text - 청크 텍스트
 * @returns {string} 포맷된 텍스트
 */
function formatEmbeddingText(metadata, text) {
  const parts = [];
  
  // 메타데이터를 헤더에 포함
  if (metadata.preacher) {
    parts.push(`[설교자: ${metadata.preacher}]`);
  }
  if (metadata.sermon_topic) {
    parts.push(`[주제: ${metadata.sermon_topic}]`);
  }
  if (metadata.bible_verse) {
    parts.push(`[성경말씀: ${metadata.bible_verse}]`);
  }
  if (metadata.serviceDate) {
    parts.push(`[날짜: ${metadata.serviceDate}]`);
  }
  if (metadata.serviceType) {
    parts.push(`[${metadata.serviceType}]`);
  }
  if (metadata.videoTitle) {
    parts.push(`[${metadata.videoTitle}]`);
  }
  if (metadata.keywords && metadata.keywords.length > 0) {
    parts.push(`[키워드: ${metadata.keywords.join(', ')}]`);
  }
  
  return parts.join(' ') + ' ' + text;
}
