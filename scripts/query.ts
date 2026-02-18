import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const chunks = await sql`SELECT chunk_index, content_hash, total_chunks FROM audio_chunks WHERE item_id = 'df9dfe54-8ef8-481c-9a7c-50f5330ea9c8' ORDER BY chunk_index`;
  for (const c of chunks) {
    console.log(`chunk ${c.chunk_index}: hash=${c.content_hash} total=${c.total_chunks}`);
  }
}

main().catch(console.error);
