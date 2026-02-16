import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSQL, ensureSchema } from "@/lib/db";
import { splitTextIntoChunks, synthesizeChunk, hashContent } from "@/lib/tts";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const sql = getSQL();
    const { itemId, chunkIndex } = await request.json();

    if (!itemId || chunkIndex === undefined) {
      return NextResponse.json(
        { error: "itemId and chunkIndex required" },
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

    if (chunkIndex >= chunks.length) {
      return NextResponse.json(
        { error: "Chunk index out of range" },
        { status: 400 }
      );
    }

    // Check if this chunk already exists with same content hash
    const existing =
      await sql`SELECT blob_url FROM audio_chunks WHERE item_id = ${itemId} AND chunk_index = ${chunkIndex} AND content_hash = ${contentHash}`;
    if (existing.length > 0) {
      return NextResponse.json({
        chunkIndex,
        totalChunks: chunks.length,
        blobUrl: existing[0].blob_url,
        done: chunkIndex >= chunks.length - 1,
        alreadyCached: true,
      });
    }

    // Synthesize via Google TTS
    const { buffer } = await synthesizeChunk(chunks[chunkIndex]);

    // Upload to Vercel Blob
    const blobPath = `audio/${itemId}/chunk-${String(chunkIndex).padStart(4, "0")}.mp3`;
    const blob = await put(blobPath, buffer, {
      access: "public",
      contentType: "audio/mpeg",
      addRandomSuffix: false,
    });

    // Upsert into audio_chunks table
    await sql`
      INSERT INTO audio_chunks (item_id, chunk_index, blob_url, total_chunks, content_hash)
      VALUES (${itemId}, ${chunkIndex}, ${blob.url}, ${chunks.length}, ${contentHash})
      ON CONFLICT (item_id, chunk_index)
      DO UPDATE SET blob_url = ${blob.url}, total_chunks = ${chunks.length}, content_hash = ${contentHash}
    `;

    return NextResponse.json({
      chunkIndex,
      totalChunks: chunks.length,
      blobUrl: blob.url,
      done: chunkIndex >= chunks.length - 1,
      alreadyCached: false,
    });
  } catch (error) {
    console.error("TTS generate error:", error);
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 }
    );
  }
}
