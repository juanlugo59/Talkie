import { NextRequest, NextResponse } from "next/server";
import { getSQL, ensureSchema } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const sql = getSQL();
  const { id } = await params;
  const updates = await request.json();

  const existing = await sql`SELECT * FROM folders WHERE id = ${id}`;
  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = existing[0];
  const name = updates.name ?? row.name;
  const color = updates.color ?? row.color;

  await sql`UPDATE folders SET name = ${name}, color = ${color} WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const sql = getSQL();
  const { id } = await params;
  await sql`DELETE FROM folders WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
