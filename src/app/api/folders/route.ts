import { NextRequest, NextResponse } from "next/server";
import { getSQL, ensureSchema } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  const sql = getSQL();
  const rows = await sql`
    SELECT id, name, color, created_at AS "createdAt"
    FROM folders
    ORDER BY created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  await ensureSchema();
  const sql = getSQL();
  const { id, name, color, createdAt } = await request.json();
  await sql`
    INSERT INTO folders (id, name, color, created_at)
    VALUES (${id}, ${name}, ${color}, ${createdAt})
  `;
  return NextResponse.json({ ok: true });
}
