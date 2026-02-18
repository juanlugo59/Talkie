"use client";

import { useEffect, useRef, useCallback } from "react";
import { TextItem } from "@/types";

// Shared pause flag — set by useTTS when user is playing
let paused = false;
export function pauseBackgroundGeneration() { paused = true; }
export function resumeBackgroundGeneration() { paused = false; }

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitWhilePaused() {
  while (paused) {
    await delay(500);
  }
}

export function useAudioCache(items: TextItem[]) {
  const generatingRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const completedRef = useRef<Set<string>>(new Set());
  const initialGenDone = useRef(false);

  const checkAndGenerate = useCallback(async (item: TextItem) => {
    if (generatingRef.current.has(item.id)) return;
    if (completedRef.current.has(item.id)) return;
    generatingRef.current.add(item.id);

    try {
      // Wait if playback is active
      await waitWhilePaused();
      if (!mountedRef.current) return;

      // Single call generates ALL chunks for this item
      const res = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });

      if (!res.ok) {
        if (res.status === 404) return; // Item deleted
        throw new Error(`Generation failed (${res.status})`);
      }

      const result = await res.json();
      if (result.done) {
        completedRef.current.add(item.id);
      }
    } catch (error) {
      console.error(`Audio generation failed for ${item.id}:`, error);
    } finally {
      generatingRef.current.delete(item.id);
    }
  }, []);

  const generateAll = useCallback(async () => {
    for (const item of items) {
      if (!mountedRef.current) break;
      if (completedRef.current.has(item.id) || generatingRef.current.has(item.id)) continue;
      // Wait if playback is active before starting next item
      await waitWhilePaused();
      if (!mountedRef.current) break;
      await checkAndGenerate(item);
    }
  }, [items, checkAndGenerate]);

  useEffect(() => {
    mountedRef.current = true;
    // Auto-generate all audio once after page load (one API call per item)
    if (initialGenDone.current || items.length === 0) return;
    const timer = setTimeout(() => {
      if (mountedRef.current && !initialGenDone.current) {
        initialGenDone.current = true;
        generateAll();
      }
    }, 3000);
    return () => {
      clearTimeout(timer);
      mountedRef.current = false;
    };
  }, [items, generateAll]);

  const invalidate = useCallback(
    async (itemId: string) => {
      completedRef.current.delete(itemId);
      await fetch(`/api/tts/cache/${itemId}`, { method: "DELETE" });
      const item = items.find((i) => i.id === itemId);
      if (item) {
        checkAndGenerate(item);
      }
    },
    [items, checkAndGenerate]
  );

  return { invalidate, generateAll };
}
