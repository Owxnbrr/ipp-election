// app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import type { CartItem, PricingBlockRow, ProductKind } from "@/types";
import { priceOrder } from "@/lib/pricing";

const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---- Zod schemas
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

const checkoutBodySchema = z.object({
  customerEmail: z.string().email().optional(),
  items: z.array(cartItemSchema).min(1),
});

function productLabel(kind: ProductKind): string {
  switch (kind) {
    case "professions_de_foi":
      return "Professions de foi";
    case "bulletins_de_vote":
      return "Bulletins de vote";
    case "affiches":
      return "Affiches";
  }
}

function itemLabel(item: CartItem): string {
  if (item.productKind === "professions_de_foi") {
    return `${productLabel(item.productKind)} - ${item.impression === "recto" ? "Recto" : "Recto-verso"}`;
  }
  if (item.productKind === "bulletins_de_vote") {
    const fmt = item.bulletinFormat === "liste_5_31" ? "Liste 5–31" : "Liste 32+";
    return `${productLabel(item.productKind)} - ${fmt} - ${
      item.impression === "recto" ? "Recto" : "Recto-verso"
    }`;
  }
  const af = item.afficheFormat === "grand_format" ? "Grand format 594×841" : "Petit format 297×420";
  return `${productLabel(item.productKind)} - ${af}`;
}

// ✅ helper: récupère un champ cents peu importe le casing
function pickCents(obj: any, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = checkoutBodySchema.parse(json);

    // ✅ URL site robuste (prod Netlify + local)
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.BASE_URL ||
      env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    // 1) Pricing blocks
    const { data: blocks, error: blocksErr } = await supabaseAdmin
      .from("pricing_blocks")
      .select("*")
      .eq("is_active", true);

    if (blocksErr) throw blocksErr;

    const allBlocks = (blocks ?? []) as PricingBlockRow[];

    // 2) Prix serveur
    const pricedOrder: any = priceOrder(body.items as CartItem[], allBlocks);

    const subtotalHtCents = pickCents(pricedOrder, ["subtotalHtCents", "subtotal_ht_cents"]);
    const vatCents = pickCents(pricedOrder, ["vatCents", "vat_cents"]);
    const totalTtcCents = pickCents(pricedOrder, ["totalTtcCents", "total_ttc_cents"]);
    const vatRate = typeof pricedOrder?.vatRate === "number" ? pricedOrder.vatRate : null;

    if (subtotalHtCents == null || totalTtcCents == null) {
      throw new Error("Prix serveur invalide (subtotal/total manquant). Vérifie la sortie de priceOrder().");
    }

    // 3) Create order
    const { data: orderInsert, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        status: "pending",
        currency: "eur",
        customer_email: body.customerEmail ?? null,

        total_ht_cents: subtotalHtCents,
        tva_rate: vatRate,
        total_ttc_cents: totalTtcCents,
        shipping_cents: 0,
      })
      .select("id")
      .single();

    if (orderErr) throw orderErr;
    const orderId = orderInsert.id as string;

    // 4) Insert order_items
    const itemsRows = (pricedOrder.items ?? []).map((it: any) => {
      const label = itemLabel(it as CartItem);

      return {
        order_id: orderId,
        product_type: it.productKind, // ✅ IMPORTANT (NOT NULL)
        product_name: label,
        options: {
          quantity: it.quantity,
          impression: it.productKind !== "affiches" ? it.impression : null,
          bulletin_format: it.productKind === "bulletins_de_vote" ? it.bulletinFormat : null,
          affiche_format: it.productKind === "affiches" ? it.afficheFormat : null,

          total_ht_cents: pickCents(it, ["totalHtCents", "total_ht_cents"]),
          vat_cents: pickCents(it, ["vatCents", "vat_cents"]),
          total_ttc_cents: pickCents(it, ["totalTtcCents", "total_ttc_cents"]),
          vat_rate: typeof it?.vatRate === "number" ? it.vatRate : vatRate,
        },
      };
    });

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (itemsErr) throw itemsErr;

    // 5) Stripe checkout — ✅ TVA incluse (TTC)
    const lineItems = (pricedOrder.items ?? []).map((it: any) => {
      const totalTtc = pickCents(it, ["totalTtcCents", "total_ttc_cents"]);
      if (totalTtc == null || totalTtc <= 0) {
        throw new Error(`Prix TTC invalide pour un item (${itemLabel(it)}).`);
      }

      return {
        price_data: {
          currency: "eur",
          product_data: {
            name: `${itemLabel(it)} (Qté: ${it.quantity})`,
            metadata: { order_id: orderId, product_kind: it.productKind },
          },
          unit_amount: totalTtc, // ✅ TTC
        },
        quantity: 1,
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: body.customerEmail,
      line_items: lineItems,
      success_url: `${siteUrl}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/commande?canceled=1`,
      metadata: { order_id: orderId },
    });

    // 6) Save stripe session id
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderId);

    if (updErr) throw updErr;

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("CHECKOUT_ERROR:", err);

    // ✅ Stripe errors lisibles
    const stripeMsg =
      err?.raw?.message ||
      err?.message ||
      "Unknown error";

    return NextResponse.json({ error: stripeMsg }, { status: 400 });
  }
}
