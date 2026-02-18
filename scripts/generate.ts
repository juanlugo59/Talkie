/**
 * Local audio generation script.
 * Reads text items from the database, generates TTS audio via Google Cloud,
 * uploads MP3 files to Dropbox, and stores the Dropbox URLs in the database.
 *
 * Usage: npx tsx scripts/generate.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(__dirname, "../.env.local") });

import { neon } from "@neondatabase/serverless";
import { SignJWT, importPKCS8 } from "jose";

// --- Config ---
const TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1beta1/text:synthesize";
const TTS_VOICE = "en-US-Chirp3-HD-Algenib";
const MAX_BYTES = 4500;
const DROPBOX_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";
const DROPBOX_SHARED_LINK_URL = "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings";
const DROPBOX_FOLDER = "/Talkie/audio";

// --- DB ---
function getSQL() {
  return neon(process.env.DATABASE_URL!);
}

// --- Google OAuth ---
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const clientEmail = process.env.GOOGLE_TTS_CLIENT_EMAIL!;
  const privateKey = process.env.GOOGLE_TTS_PRIVATE_KEY!.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(privateKey, "RS256");

  const jwt = await new SignJWT({
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/cloud-platform",
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(key);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  };

  return cachedToken.token;
}

// --- Markdown stripping ---
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")       // ## headings
    .replace(/\*\*(.+?)\*\*/g, "$1")    // **bold**
    .replace(/\*(.+?)\*/g, "$1")        // *italic*
    .replace(/__(.+?)__/g, "$1")        // __bold__
    .replace(/_(.+?)_/g, "$1")          // _italic_
    .replace(/~~(.+?)~~/g, "$1")        // ~~strikethrough~~
    .replace(/`(.+?)`/g, "$1")          // `inline code`
    .replace(/^\s*[-*+]\s+/gm, "")      // - list items
    .replace(/^\s*\d+\.\s+/gm, "")      // 1. ordered lists
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // [links](url)
    .replace(/!\[.*?\]\(.+?\)/g, "");   // ![images](url)
}

// --- Text splitting ---
function splitTextIntoChunks(text: string): string[] {
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= MAX_BYTES) {
    return [text];
  }

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const combined = current + sentence;
    if (encoder.encode(combined).length > MAX_BYTES && current) {
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

// --- TTS ---
async function synthesizeChunk(chunkText: string): Promise<Buffer> {
  const accessToken = await getAccessToken();

  const ttsRes = await fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { text: chunkText },
      voice: { languageCode: "en-US", name: TTS_VOICE },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });

  if (!ttsRes.ok) {
    const err = await ttsRes.text().catch(() => "unknown");
    throw new Error(`Google TTS API error (${ttsRes.status}): ${err}`);
  }

  const ttsData = await ttsRes.json();
  if (!ttsData.audioContent) {
    throw new Error("No audio returned from Google TTS");
  }

  return Buffer.from(ttsData.audioContent, "base64");
}

// --- Content hash ---
async function hashContent(content: string): Promise<string> {
  const clean = stripMarkdown(content);
  const encoder = new TextEncoder();
  const data = encoder.encode(TTS_VOICE + ":" + clean);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16);
}

// --- Dropbox ---
async function uploadToDropbox(filePath: string, data: Buffer): Promise<string> {
  const token = process.env.DROPBOX_ACCESS_TOKEN;
  if (!token) throw new Error("DROPBOX_ACCESS_TOKEN not set in .env.local");

  // Upload file
  const uploadRes = await fetch(DROPBOX_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: filePath,
        mode: "overwrite",
        autorename: false,
      }),
    },
    body: new Uint8Array(data),
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Dropbox upload failed (${uploadRes.status}): ${err}`);
  }

  // Create shared link
  const linkRes = await fetch(DROPBOX_SHARED_LINK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: filePath,
      settings: { requested_visibility: "public" },
    }),
  });

  let sharedUrl: string;

  if (linkRes.ok) {
    const linkData = await linkRes.json();
    sharedUrl = linkData.url;
  } else {
    // Link might already exist — try to get existing
    const errText = await linkRes.text();
    if (errText.includes("shared_link_already_exists")) {
      // Extract existing URL from error or list links
      const listRes = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: filePath, direct_only: true }),
      });
      if (!listRes.ok) throw new Error(`Failed to list shared links: ${await listRes.text()}`);
      const listData = await listRes.json();
      if (listData.links?.length > 0) {
        sharedUrl = listData.links[0].url;
      } else {
        throw new Error("Shared link exists but couldn't retrieve it");
      }
    } else {
      throw new Error(`Dropbox shared link failed (${linkRes.status}): ${errText}`);
    }
  }

  // Convert to direct download URL
  // https://www.dropbox.com/s/abc123/file.mp3?dl=0 → https://dl.dropboxusercontent.com/s/abc123/file.mp3
  return sharedUrl
    .replace("www.dropbox.com", "dl.dropboxusercontent.com")
    .replace(/\?dl=\d$/, "");
}

// --- Main ---
async function generateAll(): Promise<number> {
  const sql = getSQL();

  // Ensure schema
  await sql`CREATE TABLE IF NOT EXISTS audio_chunks (
    item_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    blob_url TEXT NOT NULL,
    total_chunks INTEGER NOT NULL,
    content_hash TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (item_id, chunk_index)
  )`;

  // Get all items
  const items = await sql`SELECT id, title, content FROM text_items ORDER BY created_at DESC`;
  let generated = 0;

  for (const item of items) {
    const cleanContent = stripMarkdown(item.content);
    const contentHash = await hashContent(cleanContent);
    const chunks = splitTextIntoChunks(cleanContent);

    // Check existing cached chunks
    const existing = await sql`
      SELECT chunk_index FROM audio_chunks
      WHERE item_id = ${item.id} AND content_hash = ${contentHash}
    `;
    const existingSet = new Set(existing.map((r) => r.chunk_index));

    if (existingSet.size === chunks.length) continue;

    const missing = chunks.length - existingSet.size;
    console.log(`▶ "${item.title}" — generating ${missing} of ${chunks.length} chunks...`);

    for (let i = 0; i < chunks.length; i++) {
      if (existingSet.has(i)) continue;

      process.stdout.write(`  chunk ${i + 1}/${chunks.length}...`);

      // Synthesize
      const buffer = await synthesizeChunk(chunks[i]);

      // Upload to Dropbox
      const dropboxPath = `${DROPBOX_FOLDER}/${item.id}/chunk-${String(i).padStart(4, "0")}.mp3`;
      const url = await uploadToDropbox(dropboxPath, buffer);

      // Store URL in database
      await sql`
        INSERT INTO audio_chunks (item_id, chunk_index, blob_url, total_chunks, content_hash)
        VALUES (${item.id}, ${i}, ${url}, ${chunks.length}, ${contentHash})
        ON CONFLICT (item_id, chunk_index)
        DO UPDATE SET blob_url = ${url}, total_chunks = ${chunks.length}, content_hash = ${contentHash}
      `;

      console.log(` done (${(buffer.length / 1024).toFixed(1)} KB)`);
      generated++;
    }

    console.log(`  ✓ "${item.title}" complete\n`);
  }

  return generated;
}

generateAll()
  .then((count) => console.log(count > 0 ? `\nGenerated ${count} chunk(s). All done!` : "Everything up to date."))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
