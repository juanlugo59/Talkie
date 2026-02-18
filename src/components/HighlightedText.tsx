"use client";

import { useMemo, useRef, useEffect } from "react";
import { tokenizeText, computeWordWeights, findActiveWordByProgress } from "@/lib/tokenize";

interface HighlightedTextProps {
  text: string;
  progress: number;
  isActive: boolean;
}

export function HighlightedText({
  text,
  progress,
  isActive,
}: HighlightedTextProps) {
  const tokens = useMemo(() => tokenizeText(text), [text]);
  const weights = useMemo(() => computeWordWeights(tokens), [tokens]);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const lastScrollTime = useRef(0);

  const activeWordIndex = isActive
    ? findActiveWordByProgress(tokens, weights, progress)
    : -1;

  useEffect(() => {
    if (activeWordIndex < 0 || !activeWordRef.current) return;

    const now = Date.now();
    if (now - lastScrollTime.current < 300) return;
    lastScrollTime.current = now;

    const word = activeWordRef.current;
    const scrollParent = word.closest(".overflow-y-auto");
    if (!scrollParent) return;

    const parentRect = scrollParent.getBoundingClientRect();
    const wordRect = word.getBoundingClientRect();
    const padding = 60;

    if (
      wordRect.top < parentRect.top + padding ||
      wordRect.bottom > parentRect.bottom - padding
    ) {
      word.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeWordIndex]);

  if (!isActive) {
    return (
      <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
        {text}
      </div>
    );
  }

  return (
    <div className="whitespace-pre-wrap leading-relaxed text-foreground/90">
      {tokens.map((token, i) => {
        if (!token.isWord) {
          return <span key={i}>{token.text}</span>;
        }

        const isActiveWord = i === activeWordIndex;

        return (
          <span
            key={i}
            ref={isActiveWord ? activeWordRef : undefined}
            className={
              isActiveWord
                ? "text-foreground bg-accent/25 rounded-md px-1 py-0.5 -mx-1"
                : undefined
            }
          >
            {token.text}
          </span>
        );
      })}
    </div>
  );
}
