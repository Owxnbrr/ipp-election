import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { CartItem, PricingBlockRow } from "@/types";
import { priceOrder } from "@/lib/pricing";

export const runtime = "nodejs";

const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const professionsItemSchema = z.object({
  productKind: z.literal("professions_de_foi"),
  quantity: z.number().int().positive(),
  impression: z.enum(["recto", "recto_verso"]),
});

const bulletinsItemSchema = z.object({
  productKind: z.literal("bulletins_de_vote"),
  quantity: z.number().int().positive(),
  impression: z.enum(["recto", "recto_verso"]),
  bulletinFormat: z.enum(["liste_5_31", "liste_32_plus"]),
});

const affichesItemSchema = z.object({
  productKind: z.literal("affiches"),
  quantity: z.number().int().positive(),
  afficheFormat: z.enum(["grand_format", "petit_format"]),
});

const cartItemSchema = z.discriminatedUnion("productKind", [
  professionsItemSchema,
  bulletinsItemSchema,
  affichesItemSchema,
]);

const bodySchema = z.object({
  customerEmail: z.string().email().optional(),
  items: z.array(cartItemSchema).min(1),
});

function safeInt(n: unknown, fallback = 0) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? Math.round(x) : fallback;
}

function labelItem(it: CartItem) {
  if (it.productKind === "professions_de_foi") {
    return `Professions de foi • ${it.impression === "recto" ? "Recto" : "Recto-verso"}`;
  }
  if (it.productKind === "bulletins_de_vote") {
    const fmt = it.bulletinFormat === "liste_5_31" ? "Liste 5–31" : "Liste 32+";
    return `Bulletins de vote • ${fmt} • ${it.impression === "recto" ? "Recto" : "Recto-verso"}`;
  }
  return `Affiches • ${it.afficheFormat === "grand_format" ? "Grand format 594×841" : "Petit format 297×420"}`;
}

function optionsJson(it: CartItem) {
  if (it.productKind === "professions_de_foi") return { impression: it.impression };
  if (it.productKind === "bulletins_de_vote") return { impression: it.impression, bulletin_format: it.bulletinFormat };
  return { affiche_format: it.afficheFormat };
}

function bulletinFormatOrNull(it: CartItem) {
  return it.productKind === "bulletins_de_vote" ? it.bulletinFormat : null;
}
function impressionOrNull(it: CartItem) {
  return it.productKind !== "affiches" ? (it as any).impression : null;
}
function afficheFormatOrNull(it: CartItem) {
  return it.productKind === "affiches" ? (it as any).afficheFormat : null;
}

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());

    // 1) pricing blocks
    const { data: blocks, error: blocksErr } = await supabaseAdmin
      .from("pricing_blocks")
      .select("*")
      .eq("is_active", true);

    if (blocksErr) throw blocksErr;
    const allBlocks = (blocks ?? []) as PricingBlockRow[];

    // 2) pricing serveur
    const priced = priceOrder(body.items as CartItem[], allBlocks);

    const subtotalHtCents = safeInt(priced.subtotalHtCents, 0);
    const vatCents = safeInt(priced.vatCents, 0);
    const totalTtcCents = safeInt(priced.totalTtcCents, subtotalHtCents + vatCents);

    if (!priced.items?.length || totalTtcCents <= 0) {
      return NextResponse.json({ error: "Prix invalide (pricing serveur)." }, { status: 400 });
    }

    // 3) create order pending
    const orderPayload: any = {
      status: "pending",
      currency: "eur",
      customer_email: body.customerEmail ?? null,
      total_ht_cents: subtotalHtCents,
      total_ttc_cents: totalTtcCents,
      subtotal_ht_cents: subtotalHtCents,
      vat_cents: vatCents,
      vat_rate: 0,
      tva_rate: 0,
      shipping_cents: 0,
    };

    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (orderErr) throw orderErr;
    const orderId = orderRow.id as string;

    // 4) order_items
    const itemsRows = (body.items as CartItem[]).map((it, idx) => {
      const p = priced.items[idx];

      const itemHt = safeInt(p.totalHtCents, 0);
      const itemVat = safeInt((p as any).vatCents, 0);
      const itemTtc = safeInt((p as any).totalTtcCents, itemHt + itemVat);
      const vatRate = typeof (p as any).vatRate === "number" ? (p as any).vatRate : null;

      return {
        order_id: orderId,
        product_type: it.productKind,
        quantity: it.quantity,
        unit_price_cents: itemTtc,
        line_total_cents: itemTtc,

        product_kind: it.productKind,
        product_name: labelItem(it),
        options: optionsJson(it),

        impression: impressionOrNull(it),
        bulletin_format: bulletinFormatOrNull(it),
        affiche_format: afficheFormatOrNull(it),

        unit_ht_cents: itemHt,
        total_ht_cents: itemHt,
        vat_cents: itemVat,
        total_ttc_cents: itemTtc,
        vat_rate: vatRate,

        pricing_breakdown: (p as any).breakdown ?? null,
      };
    });

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (itemsErr) throw itemsErr;

    return NextResponse.json({ orderId }, { status: 200 });
  } catch (err) {
    console.error("DRAFT_ORDER_ERROR:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
