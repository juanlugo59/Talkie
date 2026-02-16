import { NextRequest, NextResponse } from "next/server";
import { getSQL, ensureSchema } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  const sql = getSQL();
  const rows = await sql`
    SELECT id, title, content, created_at AS "createdAt",
           progress, last_position AS "lastPosition",
           folder_id AS "folderId"
    FROM text_items
    ORDER BY created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  await ensureSchema();
  const sql = getSQL();
  const { id, title, content, createdAt, folderId } = await request.json();
  await sql`
    INSERT INTO text_items (id, title, content, created_at, progress, last_position, folder_id)
    VALUES (${id}, ${title}, ${content}, ${createdAt}, 0, 0, ${folderId ?? null})
  `;
  return NextResponse.json({ ok: true });
}
