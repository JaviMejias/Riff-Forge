export interface LrcLine {
  time: number; // in seconds
  text: string;
}

// Regex to match [mm:ss.xx] or [mm:ss.xxx] and optional space
const LRC_REGEX = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;

export const parseLrc = (lrcString: string): LrcLine[] => {
  if (!lrcString) return [];
  
  const lines = lrcString.split('\n');
  const synced: LrcLine[] = [];
  const unsynced: LrcLine[] = [];

  for (const line of lines) {
    const match = line.match(LRC_REGEX);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] || '00';
      const ms = parseInt(msStr, 10);
      const msFraction = msStr.length === 2 ? ms / 100 : ms / 1000;
      
      const timeInSeconds = min * 60 + sec + msFraction;
      synced.push({
        time: timeInSeconds,
        text: match[4].trim(),
      });
    } else {
      const trimmed = line.trim();
      if (trimmed) {
        unsynced.push({ time: -1, text: trimmed });
      }
    }
  }

  synced.sort((a, b) => a.time - b.time);
  return [...synced, ...unsynced];
};

export const buildLrc = (lines: LrcLine[]): string => {
  return lines.map(l => {
    if (l.time <= 0) return l.text;
    const min = Math.floor(l.time / 60).toString().padStart(2, '0');
    const sec = Math.floor(l.time % 60).toString().padStart(2, '0');
    const ms = Math.floor((l.time % 1) * 100).toString().padStart(2, '0');
    return `[${min}:${sec}.${ms}] ${l.text}`;
  }).join('\n');
};

export const hasLrcTags = (text: string): boolean => {
  if (!text) return false;
  return LRC_REGEX.test(text);
};
