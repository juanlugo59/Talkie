import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const chunks = await sql`SELECT item_id, chunk_index, blob_url, content_hash, total_chunks FROM audio_chunks WHERE item_id = 'df9dfe54-8ef8-481c-9a7c-50f5330ea9c8' ORDER BY chunk_index`;
  console.log("Chapter 6 chunks:", JSON.stringify(chunks, null, 2));
}

main().catch(console.error);
