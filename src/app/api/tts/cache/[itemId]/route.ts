import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getSQL, ensureSchema } from "@/lib/db";
import { hashContent } from "@/lib/tts";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  await ensureSchema();
  const sql = getSQL();
  const { itemId } = await params;

  // Get current content to compute expected hash
  const items = await sql`SELECT content FROM text_items WHERE id = ${itemId}`;
  if (items.length === 0) {
    return NextResponse.json({ cached: false, chunks: [], totalChunks: 0, complete: false });
  }

  const currentHash = await hashContent(items[0].content);

  // Only return chunks that match the current content+voice hash
  const chunks = await sql`
    SELECT chunk_index AS "chunkIndex", blob_url AS "blobUrl", total_chunks AS "totalChunks", content_hash AS "contentHash"
    FROM audio_chunks
    WHERE item_id = ${itemId} AND content_hash = ${currentHash}
    ORDER BY chunk_index ASC
  `;

  if (chunks.length === 0) {
    return NextResponse.json({
      cached: false,
      chunks: [],
      totalChunks: 0,
      complete: false,
    });
  }

  const totalChunks = chunks[0].totalChunks;
  const complete = chunks.length === totalChunks;

  return NextResponse.json({
    cached: true,
    chunks: chunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      blobUrl: c.blobUrl,
    })),
    totalChunks,
    complete,
    contentHash: currentHash,
    generatedCount: chunks.length,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  await ensureSchema();
  const sql = getSQL();
  const { itemId } = await params;

  // Get all blob URLs before deleting DB rows
  const chunks = await sql`
    SELECT blob_url FROM audio_chunks WHERE item_id = ${itemId}
  `;

  // Delete DB rows
  await sql`DELETE FROM audio_chunks WHERE item_id = ${itemId}`;

  // Delete blob files (fire-and-forget)
  if (chunks.length > 0) {
    const urls = chunks.map((c) => c.blob_url as string);
    del(urls).catch((err) =>
      console.error("Blob deletion error:", err)
    );
  }

  return NextResponse.json({ ok: true, deletedChunks: chunks.length });
}
