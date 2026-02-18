export interface TextToken {
  text: string;
  startIndex: number;
  endIndex: number;
  isWord: boolean;
}

export function tokenizeText(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  const regex = /(\S+|\s+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      isWord: /\S/.test(match[0]),
    });
  }
  return tokens;
}

/**
 * Compute a speaking-duration weight for each token.
 * TTS speaks at roughly constant words/sec, so each word gets weight 1.
 * Punctuation adds pause weight to model natural speech pauses.
 */
export function computeWordWeights(tokens: TextToken[]): number[] {
  return tokens.map((token) => {
    if (!token.isWord) return 0;
    let weight = 1;
    if (/[.!?]$/.test(token.text)) weight += 2;
    else if (/[,;:]$/.test(token.text)) weight += 1;
    return weight;
  });
}

/**
 * Given a progress value (0-100), find the active word using weighted estimation.
 * Words are weighted by character length + punctuation pauses.
 */
export function findActiveWordByProgress(
  tokens: TextToken[],
  weights: number[],
  progress: number
): number {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return -1;

  const targetWeight = (progress / 100) * totalWeight;
  let cumulative = 0;

  for (let i = 0; i < tokens.length; i++) {
    cumulative += weights[i];
    if (tokens[i].isWord && cumulative >= targetWeight) {
      return i;
    }
  }
  return -1;
}
