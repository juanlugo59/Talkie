import { NextRequest, NextResponse } from "next/server";
import { getSQL, ensureSchema } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const sql = getSQL();
  const { id } = await params;
  const rows = await sql`
    SELECT id, title, content, created_at AS "createdAt",
           progress, last_position AS "lastPosition",
           folder_id AS "folderId"
    FROM text_items WHERE id = ${id}
  `;
  if (rows.length === 0) return NextResponse.json(null);
  return NextResponse.json(rows[0]);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const sql = getSQL();
  const { id } = await params;
  const updates = await request.json();

  const existing = await sql`SELECT * FROM text_items WHERE id = ${id}`;
  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = existing[0];
  const title = updates.title ?? row.title;
  const content = updates.content ?? row.content;
  const progress = updates.progress ?? row.progress;
  const lastPosition = updates.lastPosition ?? row.last_position;
  const folderId = "folderId" in updates ? (updates.folderId ?? null) : row.folder_id;

  await sql`
    UPDATE text_items
    SET title = ${title}, content = ${content}, progress = ${progress},
        last_position = ${lastPosition}, folder_id = ${folderId}
    WHERE id = ${id}
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const sql = getSQL();
  const { id } = await params;
  await sql`DELETE FROM text_items WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
