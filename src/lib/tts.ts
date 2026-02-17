import { SignJWT, importPKCS8 } from "jose";

const TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1beta1/text:synthesize";
const TTS_VOICE = "en-US-Chirp3-HD-Algenib";
const MAX_BYTES = 4500;

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
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

export function splitTextIntoChunks(text: string): string[] {
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

export async function synthesizeChunk(
  chunkText: string
): Promise<{ base64: string; buffer: Buffer }> {
  const accessToken = await getAccessToken();

  const ttsRes = await fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { text: chunkText },
      voice: {
        languageCode: "en-US",
        name: TTS_VOICE,
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    }),
  });

  if (!ttsRes.ok) {
    const err = await ttsRes.text().catch(() => "unknown");
    throw new Error(`Google TTS API error (${ttsRes.status}): ${err}`);
  }

  const ttsData = await ttsRes.json();
  const base64 = ttsData.audioContent;

  if (!base64) {
    throw new Error("No audio returned from Google TTS");
  }

  const buffer = Buffer.from(base64, "base64");
  return { base64, buffer };
}

export async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(TTS_VOICE + ":" + content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16);
}
