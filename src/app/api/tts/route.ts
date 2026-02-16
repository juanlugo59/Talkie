import { NextRequest, NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";

const TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const MAX_BYTES = 4500;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const clientEmail = process.env.GOOGLE_TTS_CLIENT_EMAIL!;
  const privateKey = process.env.GOOGLE_TTS_PRIVATE_KEY!.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(privateKey, "RS256");

  const jwt = await new SignJWT({
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/cloud-platform",
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(key);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  };

  return cachedToken.token;
}

function splitTextIntoChunks(text: string): string[] {
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= MAX_BYTES) {
    return [text];
  }

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const combined = current + sentence;
    if (encoder.encode(combined).length > MAX_BYTES && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = combined;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const { text, chunkIndex = 0 } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const chunks = splitTextIntoChunks(text);
    const chunk = chunks[chunkIndex];

    if (!chunk) {
      return NextResponse.json({ error: "Chunk index out of range" }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    const ttsRes = await fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text: chunk },
        voice: {
          languageCode: "en-US",
          name: "en-US-Chirp3-HD-Algenib",
        },
        audioConfig: {
          audioEncoding: "MP3",
        },
      }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error("Google TTS API error:", err);
      return NextResponse.json({ error: "TTS synthesis failed" }, { status: 500 });
    }

    const ttsData = await ttsRes.json();
    const base64 = ttsData.audioContent;

    if (!base64) {
      return NextResponse.json({ error: "No audio returned" }, { status: 500 });
    }

    return NextResponse.json({
      audio: base64,
      totalChunks: chunks.length,
      currentChunk: chunkIndex,
      hasMore: chunkIndex < chunks.length - 1,
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return NextResponse.json(
      { error: "Failed to synthesize speech" },
      { status: 500 }
    );
  }
}
