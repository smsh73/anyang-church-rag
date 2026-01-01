/**
 * 자막을 완전한 문장으로 변환
 * @param {Array} transcript - 자막 배열
 * @returns {Array} 완성된 문장 배열
 */
export function completeSentences(transcript) {
  let currentSentence = '';
  const completedSentences = [];
  let currentStartOffset = null;
  
  for (const item of transcript) {
    const text = item.correctedText || item.text;
    
    if (!currentStartOffset) {
      currentStartOffset = item.offset;
    }
    
    currentSentence += text + ' ';
    
    // 문장 종결 기호 확인
    if (/[.!?]\s*$/.test(text.trim())) {
      completedSentences.push({
        text: currentSentence.trim(),
        startOffset: currentStartOffset,
        endOffset: item.offset + (item.duration || 0)
      });
      currentSentence = '';
      currentStartOffset = null;
    }
  }
  
  // 마지막 문장 처리 (종결 기호가 없는 경우)
  if (currentSentence.trim()) {
    const lastItem = transcript[transcript.length - 1];
    completedSentences.push({
      text: currentSentence.trim(),
      startOffset: currentStartOffset || lastItem.offset,
      endOffset: lastItem.offset + (lastItem.duration || 0)
    });
  }
  
  return completedSentences;
}
