import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { adminEmailHtml, customerEmailHtml } from "@/lib/emailTemplates";

export const runtime = "nodejs";

const bodySchema = z.object({
  orderId: z.string().min(1),
  to: z.string().email().optional(), // si tu veux forcer une adresse
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const supabase = getServiceSupabase();

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, customer_email, total_ttc_cents")
      .eq("id", body.orderId)
      .single();

    if (orderErr) throw orderErr;

    const { data: files, error: filesErr } = await supabase
      .from("order_files")
      .select("storage_path, original_name")
      .eq("order_id", body.orderId)
      .order("created_at", { ascending: true });

    if (filesErr) throw filesErr;

    const expiresIn = 60 * 60 * 24 * 30; // 30 jours
    const fileLinks: Array<{ name: string; url: string }> = [];

    for (const f of files ?? []) {
      const { data: signed, error: signErr } = await supabase.storage
        .from("order-files")
        .createSignedUrl(f.storage_path, expiresIn);

      if (signErr) continue;
      if (signed?.signedUrl) fileLinks.push({ name: f.original_name, url: signed.signedUrl });
    }

    const mailFrom = process.env.MAIL_FROM!;
    const adminTo = process.env.MAIL_ADMIN_TO!;
    const to = body.to ?? adminTo; // par défaut -> ton email admin

    // Envoi "client"
    await resend.emails.send({
      from: mailFrom,
      to,
      subject: `[TEST] Confirmation commande – ${order.id}`,
      html: customerEmailHtml({
        orderId: order.id,
        totalTtcCents: order.total_ttc_cents ?? 0,
        files: fileLinks,
      }),
    });

    // Envoi "admin"
    await resend.emails.send({
      from: mailFrom,
      to,
      subject: `[TEST] Admin commande – ${order.id}`,
      html: adminEmailHtml({
        orderId: order.id,
        customerEmail: order.customer_email ?? null,
        totalTtcCents: order.total_ttc_cents ?? 0,
        files: fileLinks,
      }),
    });

    return NextResponse.json({ ok: true, to, files: fileLinks.length });
  } catch (err) {
    console.error("TEST_EMAIL_ERROR:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
