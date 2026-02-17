import { NextResponse } from "next/server";
import { getAccessToken, synthesizeChunk } from "@/lib/tts";
import { put, del } from "@vercel/blob";
import { getSQL, ensureSchema } from "@/lib/db";

export const maxDuration = 30;

export async function GET() {
  const results: Record<string, unknown> = {};

  // Step 1: Token exchange
  const t0 = Date.now();
  try {
    const token = await getAccessToken();
    results.step1_token = { ok: true, ms: Date.now() - t0, preview: token.substring(0, 20) + "..." };
  } catch (e) {
    results.step1_token = { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
    return NextResponse.json(results);
  }

  // Step 2: synthesizeChunk (uses fetchWithTimeout)
  const t1 = Date.now();
  try {
    const { buffer } = await synthesizeChunk("Hello, this is a test.");
    results.step2_synthesize = { ok: true, ms: Date.now() - t1, bytes: buffer.length };
  } catch (e) {
    results.step2_synthesize = { ok: false, ms: Date.now() - t1, error: e instanceof Error ? e.message : String(e) };
    return NextResponse.json(results);
  }

  // Step 3: DB connection (ensureSchema + query)
  const t2 = Date.now();
  try {
    await ensureSchema();
    const sql = getSQL();
    const rows = await sql`SELECT COUNT(*) AS count FROM text_items`;
    results.step3_db = { ok: true, ms: Date.now() - t2, itemCount: rows[0].count };
  } catch (e) {
    results.step3_db = { ok: false, ms: Date.now() - t2, error: e instanceof Error ? e.message : String(e) };
    return NextResponse.json(results);
  }

  // Step 4: Vercel Blob upload + delete
  const t3 = Date.now();
  try {
    const testBuffer = Buffer.from("test");
    const blob = await put("_test/diagnostic.txt", testBuffer, {
      access: "public",
      contentType: "text/plain",
      addRandomSuffix: false,
    });
    await del(blob.url);
    results.step4_blob = { ok: true, ms: Date.now() - t3, url: blob.url };
  } catch (e) {
    results.step4_blob = { ok: false, ms: Date.now() - t3, error: e instanceof Error ? e.message : String(e) };
  }

  results.totalMs = Date.now() - t0;
  return NextResponse.json(results);
}
