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

export function findActiveWordIndex(
  tokens: TextToken[],
  charPosition: number
): number {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].isWord && charPosition >= tokens[i].startIndex) {
      return i;
    }
  }
  return -1;
}
