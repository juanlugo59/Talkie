# TODO: Speechify-Style Word-by-Word Highlighting

## What We're Building
Recreate the Speechify word-by-word highlighting feature. As TTS narrates text, a rounded rectangle highlights the current word, moving word-by-word through the text. The highlight auto-scrolls to keep the active word visible. Works in both dark and light modes.

**Trigger**: The user opens the EditTextModal (taps an item) while audio is playing. The text content shows word-by-word highlighting. If no audio is playing, text displays normally.

## Technical Approach
**Estimation-based highlighting (no backend changes needed)**. The `useTTS` hook already computes a character position at ~60fps via linear interpolation of audio progress (`position = Math.round((overallProgress / 100) * content.length)`). We just need to:
1. Expose this position as reactive state from the hook
2. Tokenize text into word spans
3. Highlight the word at the current character position

---

## Step 1: Create `src/lib/tokenize.ts` (NEW FILE)

Pure utility with two functions:

### `tokenizeText(text: string): TextToken[]`
Splits text into tokens preserving all whitespace, newlines, and punctuation.

```ts
export interface TextToken {
  text: string;
  startIndex: number;  // character index in original string
  endIndex: number;    // character index of end (exclusive)
  isWord: boolean;     // true for words, false for whitespace
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
```

### `findActiveWordIndex(tokens: TextToken[], charPosition: number): number`
Given a character position, finds the index of the active word token. Searches backward so that when position lands in whitespace, we highlight the preceding word.

```ts
export function findActiveWordIndex(tokens: TextToken[], charPosition: number): number {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].isWord && charPosition >= tokens[i].startIndex) {
      return i;
    }
  }
  return -1;
}
```

---

## Step 2: Modify `src/hooks/useTTS.ts`

### Add `currentPosition` to TTSState interface (line ~6-12)
```ts
interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  progress: number;
  currentItemId: string | null;
  currentPosition: number;  // ADD THIS - character index for word highlighting
}
```

### Update initial state (line ~20-26)
Add `currentPosition: 0` to the initial useState value.

### Update the `updateProgress` function inside `setupChunkPlayback` (line ~63-78)
The existing `setState` call on line 71 already fires at ~60fps. Just add `currentPosition: position` to it:
```ts
setState((prev) => ({ ...prev, progress: overallProgress, currentPosition: position }));
```

### Reset `currentPosition: 0` in ALL state resets
There are 4 places where state is reset to idle. Add `currentPosition: 0` to each:
- `audio.onended` handler (line ~98) - when playback finishes
- `audio.onerror` handler (line ~117) - on error
- `fetchAndPlayChunk` catch block (line ~229) - on fetch error
- `stop` function (line ~294) - manual stop

---

## Step 3: Create `src/components/HighlightedText.tsx` (NEW FILE)

### Props
```ts
interface HighlightedTextProps {
  text: string;
  currentPosition: number;  // character index, 0 when not highlighting
  isActive: boolean;         // true when TTS is playing this text
}
```

### Behavior
- Uses `useMemo` to tokenize text (only re-tokenizes when text changes)
- Computes `activeWordIndex` using `findActiveWordIndex(tokens, currentPosition)`
- Renders each token as a `<span>`:
  - **Active word**: `text-foreground bg-accent/25 rounded-md px-1 py-0.5 -mx-1` (accent purple rectangle)
  - **Past words** (before active): `text-foreground/80` (slightly dimmed)
  - **Future words** (after active): inherit from parent `text-foreground/40` (significantly dimmed)
  - **Whitespace tokens**: rendered as-is (no styling)
- Auto-scroll: uses `scrollIntoView({ behavior: 'smooth', block: 'center' })` on the active word ref, **throttled to every 300ms** to prevent jitter. Only triggers when the word is near the top or bottom edge of the container.
- When `isActive=false`: renders plain text identical to the current implementation (no spans, no overhead)

### Key implementation notes
- The `-mx-1` negative margin on the active word compensates for the `px-1` padding, preventing text from shifting when the highlight appears
- `containerRef` references the scrollable div; `activeWordRef` references the highlighted word span
- The throttle uses a `lastScrollTime` ref and `Date.now()` comparison

---

## Step 4: Modify `src/components/EditTextModal.tsx`

### Add prop to interface (line ~6-13)
```ts
interface EditTextModalProps {
  item: TextItem | null;
  isPlaying: boolean;
  currentPosition: number;  // ADD THIS
  onClose: () => void;
  onSave: (id: string, title: string, content: string) => void;
  onDelete: (id: string) => void;
  onPlay: (item: TextItem) => void;
}
```

### Add to destructured props (line ~15-22)
Add `currentPosition` to the destructured props.

### Import HighlightedText
```ts
import { HighlightedText } from "@/components/HighlightedText";
```

### Replace plain text view (line 176-178)
Replace:
```tsx
<div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
  {item.content}
</div>
```

With:
```tsx
<HighlightedText
  text={item.content}
  currentPosition={currentPosition}
  isActive={isPlaying}
/>
```

---

## Step 5: Modify `src/app/page.tsx`

### Pass `currentPosition` to EditTextModal (line ~238-245)
Change the EditTextModal usage to include the new prop:
```tsx
<EditTextModal
  item={editingItem}
  isPlaying={tts.isPlaying && tts.currentItemId === editingItem?.id}
  currentPosition={
    tts.isPlaying && tts.currentItemId === editingItem?.id
      ? tts.currentPosition
      : 0
  }
  onClose={() => setEditingItem(null)}
  onSave={handleSaveItem}
  onDelete={handleDeleteFromEdit}
  onPlay={handlePlayFromEdit}
/>
```

The conditional ensures `currentPosition` is only non-zero when the specific item in the modal is the one currently playing.

---

## Verification Checklist
1. `npm run build` - should compile with no TypeScript errors
2. `npm run dev` - open the app
3. Add a text item with multiple paragraphs of text
4. Press play from the item list (bottom player bar appears, no modal opens)
5. Tap the item to open EditTextModal - word highlighting should be active and moving
6. Verify the purple/accent rectangle moves word by word
7. Verify auto-scroll works on longer texts
8. Toggle dark/light mode - highlight should look good in both
9. Pause and resume - highlight should pause and resume correctly
10. Close and re-open the modal while playing - highlight should resume at correct position
11. Play a different item - old highlight stops, new one starts when modal opens

## Performance Notes
- The `setState` for `currentPosition` fires at ~60fps (same call as existing `progress` update, no extra renders)
- Tokenization is memoized via `useMemo` - only runs when text changes
- `findActiveWordIndex` is O(n) but trivially fast for typical texts (< 50,000 words)
- Auto-scroll is throttled to 300ms intervals
- If jank occurs on very long texts, consider throttling the rAF to 20fps in useTTS.ts

## Future Enhancements (NOT part of this task)
- Google TTS SSML `<mark>` timepoints for accurate word timing (requires backend changes)
- Speed control for playback
- Auto-open reading view when play starts (user currently prefers manual open)
