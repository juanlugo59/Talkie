"use client";

import { useState } from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voices: SpeechSynthesisVoice[];
  selectedVoiceURI: string | null;
  onSelectVoice: (voiceURI: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  voices,
  selectedVoiceURI,
  onSelectVoice,
}: SettingsModalProps) {
  const [testingVoice, setTestingVoice] = useState<string | null>(null);

  if (!isOpen) return null;

  const testVoice = (voice: SpeechSynthesisVoice) => {
    window.speechSynthesis.cancel();
    setTestingVoice(voice.voiceURI);

    const utterance = new SpeechSynthesisUtterance(
      "Hello! This is how I sound when reading your texts."
    );
    utterance.voice = voice;
    utterance.rate = 1;
    utterance.onend = () => setTestingVoice(null);
    utterance.onerror = () => setTestingVoice(null);

    window.speechSynthesis.speak(utterance);
  };

  const handleSelect = (voiceURI: string) => {
    window.speechSynthesis.cancel();
    setTestingVoice(null);
    onSelectVoice(voiceURI);
  };

  const handleClose = () => {
    window.speechSynthesis.cancel();
    setTestingVoice(null);
    onClose();
  };

  // Group voices by type
  const googleVoices = voices.filter((v) =>
    v.name.toLowerCase().includes("google")
  );
  const microsoftVoices = voices.filter((v) =>
    v.name.toLowerCase().includes("microsoft")
  );
  const otherVoices = voices.filter(
    (v) =>
      !v.name.toLowerCase().includes("google") &&
      !v.name.toLowerCase().includes("microsoft")
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Voice Settings</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-card rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {voices.length === 0 ? (
            <p className="text-muted text-center py-8">
              No voices available on this device.
            </p>
          ) : (
            <div className="space-y-6">
              {googleVoices.length > 0 && (
                <VoiceGroup
                  title="Google Voices"
                  voices={googleVoices}
                  selectedVoiceURI={selectedVoiceURI}
                  testingVoice={testingVoice}
                  onSelect={handleSelect}
                  onTest={testVoice}
                />
              )}

              {microsoftVoices.length > 0 && (
                <VoiceGroup
                  title="Microsoft Voices"
                  voices={microsoftVoices}
                  selectedVoiceURI={selectedVoiceURI}
                  testingVoice={testingVoice}
                  onSelect={handleSelect}
                  onTest={testVoice}
                />
              )}

              {otherVoices.length > 0 && (
                <VoiceGroup
                  title="System Voices"
                  voices={otherVoices}
                  selectedVoiceURI={selectedVoiceURI}
                  testingVoice={testingVoice}
                  onSelect={handleSelect}
                  onTest={testVoice}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface VoiceGroupProps {
  title: string;
  voices: SpeechSynthesisVoice[];
  selectedVoiceURI: string | null;
  testingVoice: string | null;
  onSelect: (voiceURI: string) => void;
  onTest: (voice: SpeechSynthesisVoice) => void;
}

function VoiceGroup({
  title,
  voices,
  selectedVoiceURI,
  testingVoice,
  onSelect,
  onTest,
}: VoiceGroupProps) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted mb-2">{title}</h3>
      <div className="space-y-2">
        {voices.map((voice) => {
          const isSelected = voice.voiceURI === selectedVoiceURI;
          const isTesting = voice.voiceURI === testingVoice;

          return (
            <div
              key={voice.voiceURI}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-muted"
              }`}
            >
              <button
                onClick={() => onSelect(voice.voiceURI)}
                className="flex-1 text-left"
              >
                <p className="font-medium">
                  {formatVoiceName(voice.name)}
                  {isSelected && (
                    <span className="ml-2 text-accent text-sm">Selected</span>
                  )}
                </p>
                <p className="text-sm text-muted">
                  {voice.lang} {voice.localService ? "" : "(Online)"}
                </p>
              </button>
              <button
                onClick={() => onTest(voice)}
                className={`ml-3 p-2 rounded-lg transition-colors ${
                  isTesting
                    ? "bg-accent text-white"
                    : "hover:bg-card text-muted"
                }`}
                aria-label="Test voice"
              >
                {isTesting ? (
                  <svg
                    className="w-5 h-5 animate-pulse"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatVoiceName(name: string): string {
  // Clean up voice names for display
  return name
    .replace("Microsoft ", "")
    .replace("Google ", "")
    .replace(" Online (Natural)", " (Natural)")
    .replace(" Desktop", "");
}
