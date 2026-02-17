import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/tts";

export const maxDuration = 30;

export async function GET() {
  const results: Record<string, unknown> = {};
  const token = await getAccessToken();

  // Test Chirp 3 HD Algenib on v1beta1
  const t0 = Date.now();
  try {
    const res = await fetch(
      "https://texttospeech.googleapis.com/v1beta1/text:synthesize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text: "Hello, this is a voice test for Algenib." },
          voice: { languageCode: "en-US", name: "en-US-Chirp3-HD-Algenib" },
          audioConfig: { audioEncoding: "MP3" },
        }),
      }
    );
    results.chirp3_algenib_v1beta1 = {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - t0,
      ...(res.ok
        ? { bytes: (await res.json()).audioContent?.length ?? 0 }
        : { error: await res.text() }),
    };
  } catch (e) {
    results.chirp3_algenib_v1beta1 = {
      ok: false,
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // Test Neural2-F on v1 (for comparison)
  const t1 = Date.now();
  try {
    const res = await fetch(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text: "Hello, this is a voice test for Neural2." },
          voice: { languageCode: "en-US", name: "en-US-Neural2-F" },
          audioConfig: { audioEncoding: "MP3" },
        }),
      }
    );
    results.neural2f_v1 = {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - t1,
      ...(res.ok
        ? { bytes: (await res.json()).audioContent?.length ?? 0 }
        : { error: await res.text() }),
    };
  } catch (e) {
    results.neural2f_v1 = {
      ok: false,
      ms: Date.now() - t1,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json(results);
}
