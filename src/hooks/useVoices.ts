"use client";

import { useState, useEffect, useCallback } from "react";

const VOICE_STORAGE_KEY = "talkie-selected-voice";

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsLoading(false);
      return;
    }

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();

      // If no voices yet, don't update state
      if (availableVoices.length === 0) {
        return;
      }

      // Filter to English voices and sort by quality indicators
      let voicesToUse = availableVoices
        .filter((v) => v.lang.startsWith("en"))
        .sort((a, b) => {
          const aScore = getVoiceScore(a);
          const bScore = getVoiceScore(b);
          return bScore - aScore;
        });

      // Fallback to all voices if no English voices found
      if (voicesToUse.length === 0) {
        voicesToUse = [...availableVoices].sort((a, b) => {
          const aScore = getVoiceScore(a);
          const bScore = getVoiceScore(b);
          return bScore - aScore;
        });
      }

      setVoices(voicesToUse);
      setIsLoading(false);

      // Load saved preference
      const saved = localStorage.getItem(VOICE_STORAGE_KEY);
      if (saved && voicesToUse.some((v) => v.voiceURI === saved)) {
        setSelectedVoiceURI(saved);
      } else if (voicesToUse.length > 0) {
        // Default to first (highest scored) voice only if not already set
        setSelectedVoiceURI((current) => current || voicesToUse[0].voiceURI);
      }
    };

    // Try loading immediately
    loadVoices();

    // Also listen for voiceschanged event (fires asynchronously in some browsers)
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Some browsers need a small delay
    const timeoutId = setTimeout(loadVoices, 100);

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectVoice = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    localStorage.setItem(VOICE_STORAGE_KEY, voiceURI);
  }, []);

  const getSelectedVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!selectedVoiceURI) return null;
    return voices.find((v) => v.voiceURI === selectedVoiceURI) || null;
  }, [voices, selectedVoiceURI]);

  return {
    voices,
    selectedVoiceURI,
    selectVoice,
    getSelectedVoice,
    isLoading,
  };
}

// Score voices by quality (higher = better)
function getVoiceScore(voice: SpeechSynthesisVoice): number {
  let score = 0;
  const name = voice.name.toLowerCase();

  // Premium/Natural voices (highest quality)
  if (name.includes("natural") || name.includes("neural")) score += 100;

  // Google voices are generally good
  if (name.includes("google")) score += 50;

  // Microsoft voices
  if (name.includes("microsoft")) score += 40;

  // Specific high-quality voices
  if (name.includes("samantha")) score += 30; // macOS
  if (name.includes("daniel")) score += 30; // macOS UK
  if (name.includes("karen")) score += 30; // macOS AU
  if (name.includes("zira")) score += 25; // Windows
  if (name.includes("david")) score += 25; // Windows

  // Avoid compact/mobile voices
  if (name.includes("compact")) score -= 20;
  if (name.includes("mobile")) score -= 20;

  // Prefer local voices over network
  if (!voice.localService) score -= 10;

  // US English slight preference
  if (voice.lang === "en-US") score += 5;

  return score;
}
