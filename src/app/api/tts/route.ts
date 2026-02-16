import { NextRequest, NextResponse } from "next/server";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

const client = new TextToSpeechClient({
  credentials: {
    client_email: process.env.GOOGLE_TTS_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_TTS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  projectId: process.env.GOOGLE_TTS_PROJECT_ID,
});

const MAX_BYTES = 4500;

function splitTextIntoChunks(text: string): string[] {
  if (new Blob([text]).size <= MAX_BYTES) {
    return [text];
  }

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const combined = current + sentence;
    if (new Blob([combined]).size > MAX_BYTES && current) {
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

    const [response] = await client.synthesizeSpeech({
      input: { text: chunk },
      voice: {
        languageCode: "en-US",
        name: "en-US-Chirp3-HD-Algenib",
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    });

    const audioContent = response.audioContent;
    if (!audioContent) {
      return NextResponse.json({ error: "No audio returned" }, { status: 500 });
    }

    const base64 = Buffer.isBuffer(audioContent)
      ? audioContent.toString("base64")
      : Buffer.from(audioContent as Uint8Array).toString("base64");

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
