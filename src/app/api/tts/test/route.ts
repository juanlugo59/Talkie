import { NextRequest, NextResponse } from "next/server";
import { splitTextIntoChunks, synthesizeChunk } from "@/lib/tts";

export const maxDuration = 60;

// GET — quick check (no body needed)
export async function GET() {
  const t0 = Date.now();
  try {
    const { base64 } = await synthesizeChunk("Hello, this is a cold start test.");
    return NextResponse.json({
      ok: true,
      ms: Date.now() - t0,
      audioBytes: base64.length,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

// POST — exact same flow as /api/tts (to test if POST works)
export async function POST(request: NextRequest) {
  const t0 = Date.now();
  try {
    const { text, chunkIndex = 0 } = await request.json();
    const tParse = Date.now() - t0;

    const chunks = splitTextIntoChunks(text);
    const chunk = chunks[chunkIndex];
    if (!chunk) {
      return NextResponse.json({ error: "No chunk" }, { status: 400 });
    }
    const tSplit = Date.now() - t0;

    const { base64 } = await synthesizeChunk(chunk);
    const tSynth = Date.now() - t0;

    return NextResponse.json({
      ok: true,
      parseMs: tParse,
      splitMs: tSplit,
      synthMs: tSynth,
      totalMs: Date.now() - t0,
      totalChunks: chunks.length,
      audioBytes: base64.length,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      totalMs: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
