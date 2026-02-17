import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

export async function POST(req: Request, ctx: { params: { orderId: string } }) {
  try {
    const { orderId } = ctx.params;

    const form = await req.formData();
    const files = form.getAll("files");

    if (!files.length) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }

    const uploaded: Array<{ path: string; name: string }> = [];

    for (const f of files) {
      if (!(f instanceof File)) continue;

      const originalName = f.name || "file";
      const safeName = sanitizeFileName(originalName);
      const path = `orders/${orderId}/${Date.now()}-${safeName}`;

      const arrayBuffer = await f.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const { error: upErr } = await supabaseAdmin.storage.from("order-files").upload(path, buffer, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });

      if (upErr) throw upErr;

      const { error: dbErr } = await supabaseAdmin.from("order_files").insert({
        order_id: orderId,
        storage_path: path,
        original_name: originalName,
        mime_type: f.type || null,
        size_bytes: f.size || null,
      });

      if (dbErr) throw dbErr;

      uploaded.push({ path, name: originalName });
    }

    return NextResponse.json({ uploaded }, { status: 200 });
  } catch (err) {
    console.error("UPLOAD_FILES_ERROR:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
