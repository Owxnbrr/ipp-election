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

export async function POST(req: Request) {
  try {
    // 1) Validate body
    const json = await req.json();
    const body = checkoutBodySchema.parse(json);

    // 2) Load active pricing blocks
    const { data: blocks, error: blocksErr } = await supabaseAdmin
      .from("pricing_blocks")
      .select("*")
      .eq("is_active", true);

    if (blocksErr) throw blocksErr;

    const allBlocks = (blocks ?? []) as PricingBlockRow[];

    // 3) Server pricing (source of truth)
    // priceOrder doit déjà appliquer TVA (5.5% / 20%) selon tes règles.
    const pricedOrder = priceOrder(body.items as CartItem[], allBlocks);

    // 4) Create order row (match Supabase schema)
    const { data: orderInsert, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        status: "pending",
        currency: "eur",
        customer_email: body.customerEmail ?? null,

        // ✅ match tes colonnes Supabase
        total_ht_cents: pricedOrder.subtotalHtCents,
        tva_rate: pricedOrder.vatRate,
        total_ttc_cents: pricedOrder.totalTtcCents,
        shipping_cents: 0,
      })
      .select("id")
      .single();

    if (orderErr) throw orderErr;
    const orderId = orderInsert.id as string;

    // 5) Insert order_items (match Supabase schema: product_type, product_name, options)
    const itemsRows = pricedOrder.items.map((it: any) => {
      const label = itemLabel(it);

      return {
        order_id: orderId,

        // ✅ colonnes NOT NULL attendues
        product_type: it.productKind, // ex: "professions_de_foi"
        product_name: label,

        // ✅ options jsonb : tu mets tout ce que tu veux tracer
        options: {
          quantity: it.quantity,

          impression: it.productKind !== "affiches" ? it.impression : null,
          bulletin_format: it.productKind === "bulletins_de_vote" ? it.bulletinFormat : null,
          affiche_format: it.productKind === "affiches" ? it.afficheFormat : null,

          // pricing (si dispo dans priceOrder)
          unit_ht_cents: it.unitHtCents ?? null,
          total_ht_cents: it.totalHtCents ?? null,
          vat_rate: it.vatRate ?? pricedOrder.vatRate ?? null,
          vat_cents: it.vatCents ?? null,
          total_ttc_cents: it.totalTtcCents ?? null,

          // breakdown debug
          pricing_breakdown: it.breakdown ?? null,
        },
      };
    });

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (itemsErr) throw itemsErr;

    // 6) Stripe checkout — ✅ TVA incluse (TTC)
    // IMPORTANT: comme tes prix sont par paliers/blocs, on crée 1 ligne = 1 config,
    // avec quantity = 1 et unit_amount = total TTC de la ligne.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: body.customerEmail,
      line_items: pricedOrder.items.map((it: any) => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: `${itemLabel(it)} (Qté: ${it.quantity})`,
            metadata: { order_id: orderId, product_kind: it.productKind },
          },
          // ✅ TTC (donc TVA incluse sur Stripe)
          unit_amount: it.totalTtcCents ?? it.totalHtCents ?? 0,
        },
        quantity: 1,
      })),
      success_url: `${env.NEXT_PUBLIC_SITE_URL}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/commande?canceled=1`,
      metadata: { order_id: orderId },
    });

    // 7) Save Stripe session id
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderId);

    if (updErr) throw updErr;

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("CHECKOUT_ERROR:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
