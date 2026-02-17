import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/tts";

export const maxDuration = 30;

export async function GET() {
  const results: Record<string, unknown> = {};

  // Step 1: Test token exchange
  const t0 = Date.now();
  try {
    const token = await getAccessToken();
    results.tokenOk = true;
    results.tokenMs = Date.now() - t0;
    results.tokenPreview = token.substring(0, 20) + "...";
  } catch (e) {
    results.tokenOk = false;
    results.tokenMs = Date.now() - t0;
    results.tokenError = e instanceof Error ? e.message : String(e);
    return NextResponse.json(results);
  }

  // Step 2: Test TTS API with minimal text
  const t1 = Date.now();
  try {
    const token = await getAccessToken();
    const res = await fetch(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text: "Hello" },
          voice: { languageCode: "en-US", name: "en-US-Neural2-F" },
          audioConfig: { audioEncoding: "MP3" },
        }),
      }
    );

    results.ttsStatus = res.status;
    results.ttsMs = Date.now() - t1;

    if (!res.ok) {
      results.ttsOk = false;
      results.ttsError = await res.text();
    } else {
      const data = await res.json();
      results.ttsOk = true;
      results.audioBytes = data.audioContent?.length ?? 0;
    }
  } catch (e) {
    results.ttsOk = false;
    results.ttsMs = Date.now() - t1;
    results.ttsError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results);
}
