/**
 * YouTube 스크립트에서 불필요한 요소 제거
 */
export function cleanTranscript(transcript) {
  return transcript.map(item => {
    let cleanedText = item.text || item.correctedText || '';
    
    // 시간 표시 제거 (예: [00:12:34], (00:12:34))
    cleanedText = cleanedText.replace(/\[?\d{1,2}:\d{2}(:\d{2})?\]?/g, '');
    
    // 불필요한 기호 제거
    cleanedText = cleanedText.replace(/[▶►▷]/g, '');
    cleanedText = cleanedText.replace(/\[.*?\]/g, ''); // 대괄호 내용 제거
    cleanedText = cleanedText.replace(/\(.*?\)/g, ''); // 소괄호 내용 제거 (단, 성경 구절은 보존)
    
    // 연속된 공백 제거
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    
    // 시작/끝의 특수문자 제거
    cleanedText = cleanedText.replace(/^[^\w가-힣]+|[^\w가-힣.?!]+$/g, '');
    
    return {
      ...item,
      cleanedText
    };
  });
}

/**
 * 설교원문을 완전한 문단으로 만들기
 */
export function createParagraphs(cleanedTranscript) {
  const paragraphs = [];
  let currentParagraph = '';
  let currentStartOffset = null;
  let currentEndOffset = null;
  
  for (const item of cleanedTranscript) {
    const text = item.cleanedText || item.text || '';
    
    if (!text.trim()) continue;
    
    if (!currentStartOffset) {
      currentStartOffset = item.offset;
    }
    currentEndOffset = item.offset + (item.duration || 0);
    
    currentParagraph += text + ' ';
    
    // 문단 종료 조건: 마침표, 느낌표, 물음표 후 일정 시간 간격
    if (/[.!?]\s*$/.test(text)) {
      // 다음 항목과 시간 간격이 크면 문단 종료
      const nextItem = cleanedTranscript[cleanedTranscript.indexOf(item) + 1];
      if (!nextItem || (nextItem.offset - currentEndOffset) > 2000) {
        paragraphs.push({
          text: currentParagraph.trim(),
          startOffset: currentStartOffset,
          endOffset: currentEndOffset
        });
        currentParagraph = '';
        currentStartOffset = null;
      }
    }
  }
  
  // 마지막 문단 처리
  if (currentParagraph.trim()) {
    paragraphs.push({
      text: currentParagraph.trim(),
      startOffset: currentStartOffset,
      endOffset: currentEndOffset
    });
  }
  
  return paragraphs;
}
