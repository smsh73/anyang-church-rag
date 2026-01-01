/**
 * 시간 문자열을 초 단위로 변환
 * @param {string} timeStr - 시간 문자열 (예: "38:40", "1:14:40", "38분40초")
 * @returns {number} 초 단위 시간
 */
export function parseTimeToSeconds(timeStr) {
  if (!timeStr) return null;
  
  // "38:40" 형식 (분:초)
  const mmssMatch = timeStr.match(/^(\d+):(\d+)$/);
  if (mmssMatch) {
    const [, minutes, seconds] = mmssMatch;
    return parseInt(minutes) * 60 + parseInt(seconds);
  }
  
  // "1:14:40" 형식 (시:분:초)
  const hhmmssMatch = timeStr.match(/^(\d+):(\d+):(\d+)$/);
  if (hhmmssMatch) {
    const [, hours, minutes, seconds] = hhmmssMatch;
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
  }
  
  // "38분40초" 형식
  const koreanMatch = timeStr.match(/(\d+)시간\s*(\d+)분\s*(\d+)초/) || 
                      timeStr.match(/(\d+)분\s*(\d+)초/) ||
                      timeStr.match(/(\d+)시간/) ||
                      timeStr.match(/(\d+)분/) ||
                      timeStr.match(/(\d+)초/);
  
  if (koreanMatch) {
    let totalSeconds = 0;
    const hours = timeStr.match(/(\d+)시간/);
    const minutes = timeStr.match(/(\d+)분/);
    const seconds = timeStr.match(/(\d+)초/);
    
    if (hours) totalSeconds += parseInt(hours[1]) * 3600;
    if (minutes) totalSeconds += parseInt(minutes[1]) * 60;
    if (seconds) totalSeconds += parseInt(seconds[1]);
    
    return totalSeconds;
  }
  
  // 숫자만 있는 경우 초로 간주
  const numberMatch = timeStr.match(/^(\d+)$/);
  if (numberMatch) {
    return parseInt(numberMatch[1]);
  }
  
  throw new Error(`Invalid time format: ${timeStr}`);
}

/**
 * 초를 시간 문자열로 변환
 * @param {number} seconds - 초 단위 시간
 * @returns {string} "HH:MM:SS" 형식
 */
export function formatSecondsToTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
