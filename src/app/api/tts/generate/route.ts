import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSQL, ensureSchema } from "@/lib/db";
import { splitTextIntoChunks, synthesizeChunk, hashContent } from "@/lib/tts";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const sql = getSQL();
    const { itemId } = await request.json();

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId required" },
        { status: 400 }
      );
    }

    // Read item content from DB
    const rows = await sql`SELECT content FROM text_items WHERE id = ${itemId}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const content = rows[0].content;
    const contentHash = await hashContent(content);
    const chunks = splitTextIntoChunks(content);

    // Check which chunks already exist with correct hash
    const existing = await sql`
      SELECT chunk_index FROM audio_chunks
      WHERE item_id = ${itemId} AND content_hash = ${contentHash}
    `;
    const existingSet = new Set(existing.map((r) => r.chunk_index));

    // If all chunks already exist, return immediately
    if (existingSet.size === chunks.length) {
      return NextResponse.json({
        totalChunks: chunks.length,
        generated: 0,
        skipped: chunks.length,
        done: true,
      });
    }

    // Generate ALL missing chunks in this single function call
    let generated = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (existingSet.has(i)) continue;

      const { buffer } = await synthesizeChunk(chunks[i]);

      const blobPath = `audio/${itemId}/chunk-${String(i).padStart(4, "0")}.mp3`;
      const blob = await put(blobPath, buffer, {
        access: "public",
        contentType: "audio/mpeg",
        addRandomSuffix: false,
      });

      await sql`
        INSERT INTO audio_chunks (item_id, chunk_index, blob_url, total_chunks, content_hash)
        VALUES (${itemId}, ${i}, ${blob.url}, ${chunks.length}, ${contentHash})
        ON CONFLICT (item_id, chunk_index)
        DO UPDATE SET blob_url = ${blob.url}, total_chunks = ${chunks.length}, content_hash = ${contentHash}
      `;

      generated++;
    }

    return NextResponse.json({
      totalChunks: chunks.length,
      generated,
      skipped: existingSet.size,
      done: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("TTS batch generate error:", message);
    return NextResponse.json(
      { error: `Generation failed: ${message}` },
      { status: 500 }
    );
  }
}
