import { NextRequest, NextResponse } from "next/server";
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

  // Delete DB rows (Dropbox files can be cleaned up manually if needed)
  const result = await sql`DELETE FROM audio_chunks WHERE item_id = ${itemId}`;

  return NextResponse.json({ ok: true, deletedChunks: result.length });
}
