"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { TextItem } from "@/types";
import { pauseBackgroundGeneration, resumeBackgroundGeneration } from "./useAudioCache";

interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  progress: number;
  currentItemId: string | null;
}

interface UseTTSOptions {
  onProgressUpdate?: (id: string, progress: number, position: number) => void;
  onEnd?: (id: string) => void;
}

export function useTTS(options: UseTTSOptions = {}) {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    isLoading: false,
    progress: 0,
    currentItemId: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentItemRef = useRef<TextItem | null>(null);
  const chunkIndexRef = useRef(0);
  const totalChunksRef = useRef(0);
  const optionsRef = useRef(options);
  const abortRef = useRef<AbortController | null>(null);
  const rafRef = useRef<number | null>(null);
  const cachedAudioRef = useRef<HTMLAudioElement[]>([]);
  optionsRef.current = options;

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    cachedAudioRef.current = [];
  }, []);

  const setupChunkPlayback = useCallback(
    (
      audio: HTMLAudioElement,
      chunkIndex: number,
      totalChunks: number,
      getNextAudio: (() => void) | null
    ) => {
      const updateProgress = () => {
        if (!audio.duration || !currentItemRef.current || audio.paused) return;
        const chunkProgress = audio.currentTime / audio.duration;
        const overallProgress =
          ((chunkIndex + chunkProgress) / totalChunks) * 100;
        const position = Math.round(
          (overallProgress / 100) * currentItemRef.current.content.length
        );
        setState((prev) => ({ ...prev, progress: overallProgress }));
        optionsRef.current.onProgressUpdate?.(
          currentItemRef.current!.id,
          Math.round(overallProgress),
          position
        );
        rafRef.current = requestAnimationFrame(updateProgress);
      };

      audio.onplay = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(updateProgress);
      };

      audio.onpause = () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };

      audio.onended = () => {
        if (getNextAudio && currentItemRef.current) {
          chunkIndexRef.current = chunkIndex + 1;
          getNextAudio();
        } else if (currentItemRef.current) {
          const id = currentItemRef.current.id;
          setState({
            isPlaying: false,
            isPaused: false,
            isLoading: false,
            progress: 100,
            currentItemId: null,
          });
          optionsRef.current.onProgressUpdate?.(
            id,
            100,
            currentItemRef.current.content.length
          );
          optionsRef.current.onEnd?.(id);
          currentItemRef.current = null;
          resumeBackgroundGeneration();
        }
      };

      audio.onerror = () => {
        console.error("Audio playback error");
        setState({
          isPlaying: false,
          isPaused: false,
          isLoading: false,
          progress: 0,
          currentItemId: null,
        });
        currentItemRef.current = null;
      };
    },
    []
  );

  const playCached = useCallback(
    async (
      item: TextItem,
      chunks: Array<{ chunkIndex: number; blobUrl: string }>
    ) => {
      // Prefetch all chunks as Audio elements in parallel
      const audioElements = await Promise.all(
        chunks.map(
          (chunk) =>
            new Promise<HTMLAudioElement>((resolve, reject) => {
              const audio = new Audio(chunk.blobUrl);
              audio.preload = "auto";
              audio.oncanplaythrough = () => resolve(audio);
              audio.onerror = () =>
                reject(new Error(`Failed to load chunk ${chunk.chunkIndex}`));
              setTimeout(() => reject(new Error("Prefetch timeout")), 15000);
            })
        )
      );

      cachedAudioRef.current = audioElements;

      const playChunk = (index: number) => {
        if (index >= audioElements.length || !currentItemRef.current) return;

        const audio = audioElements[index];
        audioRef.current = audio;
        chunkIndexRef.current = index;
        totalChunksRef.current = audioElements.length;

        const isLast = index >= audioElements.length - 1;
        setupChunkPlayback(
          audio,
          index,
          audioElements.length,
          isLast ? null : () => playChunk(index + 1)
        );

        audio.play().catch((err) => console.error("Cached play failed:", err));
      };

      playChunk(0);
      setState((prev) => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        isLoading: false,
      }));
    },
    [setupChunkPlayback]
  );

  const fetchAndPlayChunk = useCallback(
    async (item: TextItem, chunkIndex: number) => {
      abortRef.current = new AbortController();

      if (chunkIndex === 0) {
        setState((prev) => ({ ...prev, isLoading: true }));
      }

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: item.content, chunkIndex }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "TTS request failed");
        }

        const data = await res.json();
        totalChunksRef.current = data.totalChunks;

        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audioRef.current = audio;

        const hasMore = data.hasMore && currentItemRef.current;
        setupChunkPlayback(
          audio,
          chunkIndex,
          data.totalChunks,
          hasMore
            ? () => fetchAndPlayChunk(currentItemRef.current!, chunkIndex + 1)
            : null
        );

        await audio.play();
        setState((prev) => ({
          ...prev,
          isPlaying: true,
          isPaused: false,
          isLoading: false,
        }));
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("TTS error:", error);
        setState({
          isPlaying: false,
          isPaused: false,
          isLoading: false,
          progress: 0,
          currentItemId: null,
        });
        currentItemRef.current = null;
        resumeBackgroundGeneration();
      }
    },
    [setupChunkPlayback]
  );

  const speak = useCallback(
    async (item: TextItem) => {
      cleanup();
      currentItemRef.current = item;
      chunkIndexRef.current = 0;

      setState({
        isPlaying: true,
        isPaused: false,
        isLoading: true,
        currentItemId: item.id,
        progress: 0,
      });

      // Pause background generation so our request gets through
      pauseBackgroundGeneration();

      // Check for cached audio first
      try {
        const cacheRes = await fetch(`/api/tts/cache/${item.id}`);
        if (cacheRes.ok) {
          const cache = await cacheRes.json();
          if (cache.complete && cache.chunks.length > 0) {
            await playCached(item, cache.chunks);
            return;
          }
        }
      } catch (e) {
        console.warn("Cache check failed, falling back to live synthesis:", e);
      }

      // Fallback: live synthesis
      fetchAndPlayChunk(item, 0);
    },
    [cleanup, fetchAndPlayChunk, playCached]
  );

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setState((prev) => ({ ...prev, isPlaying: false, isPaused: true }));
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      setState((prev) => ({ ...prev, isPlaying: true, isPaused: false }));
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    currentItemRef.current = null;
    chunkIndexRef.current = 0;
    setState({
      isPlaying: false,
      isPaused: false,
      isLoading: false,
      progress: 0,
      currentItemId: null,
    });
    resumeBackgroundGeneration();
  }, [cleanup]);

  const toggle = useCallback(
    (item: TextItem) => {
      if (state.currentItemId === item.id) {
        if (state.isPlaying) {
          pause();
        } else if (state.isPaused) {
          resume();
        } else {
          speak(item);
        }
      } else {
        speak(item);
      }
    },
    [state.currentItemId, state.isPlaying, state.isPaused, pause, resume, speak]
  );

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    isSupported: true,
    speak,
    pause,
    resume,
    stop,
    toggle,
  };
}
