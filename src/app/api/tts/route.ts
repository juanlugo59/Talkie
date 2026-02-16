import { NextRequest, NextResponse } from "next/server";
import { splitTextIntoChunks, synthesizeChunk } from "@/lib/tts";

export async function POST(request: NextRequest) {
  try {
    const { text, chunkIndex = 0 } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const chunks = splitTextIntoChunks(text);
    const chunk = chunks[chunkIndex];

    if (!chunk) {
      return NextResponse.json(
        { error: "Chunk index out of range" },
        { status: 400 }
      );
    }

    const { base64 } = await synthesizeChunk(chunk);

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
