// app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { NextRequest } from "next/server";

import type { CartItem, PricingBlockRow, ProductKind } from "@/types";
import { priceOrder } from "@/lib/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ---- Zod schemas (strict unions)
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
    return `${productLabel(item.productKind)} - ${fmt} - ${item.impression === "recto" ? "Recto" : "Recto-verso"}`;
  }
  const af = item.afficheFormat === "grand_format" ? "Grand format 594×841" : "Petit format 297×420";
  return `${productLabel(item.productKind)} - ${af}`;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = checkoutBodySchema.parse(json);

    // 1) Charger la grille depuis Supabase
    const { data: blocks, error: blocksErr } = await supabaseAdmin
      .from("pricing_blocks")
      .select("*")
      .eq("is_active", true);

    if (blocksErr) throw blocksErr;

    const allBlocks = (blocks ?? []) as PricingBlockRow[];

    // 2) Pricing serveur
    const pricedOrder = priceOrder(body.items, allBlocks, 0.2); // TODO: remplacer 0.2 si TVA variable

    // 3) Créer order + order_items
    const { data: orderInsert, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        status: "pending",
        currency: "eur",
        customer_email: body.customerEmail ?? null,
        subtotal_ht_cents: pricedOrder.subtotalHtCents,
        vat_rate: pricedOrder.vatRate,
        vat_cents: pricedOrder.vatCents,
        total_ttc_cents: pricedOrder.totalTtcCents,
      })
      .select("id")
      .single();

    if (orderErr) throw orderErr;
    const orderId = orderInsert.id as string;

    const itemsRows = pricedOrder.items.map((it) => {
      if (it.productKind === "professions_de_foi") {
        return {
          order_id: orderId,
          product_kind: it.productKind,
          quantity: it.quantity,
          impression: it.impression,
          bulletin_format: null,
          affiche_format: null,
          unit_ht_cents: it.unitHtCents,
          total_ht_cents: it.totalHtCents,
          pricing_breakdown: it.breakdown,
        };
      }
      if (it.productKind === "bulletins_de_vote") {
        return {
          order_id: orderId,
          product_kind: it.productKind,
          quantity: it.quantity,
          impression: it.impression,
          bulletin_format: it.bulletinFormat,
          affiche_format: null,
          unit_ht_cents: it.unitHtCents,
          total_ht_cents: it.totalHtCents,
          pricing_breakdown: it.breakdown,
        };
      }
      return {
        order_id: orderId,
        product_kind: it.productKind,
        quantity: it.quantity,
        impression: null,
        bulletin_format: null,
        affiche_format: it.afficheFormat,
        unit_ht_cents: it.unitHtCents,
        total_ht_cents: it.totalHtCents,
        pricing_breakdown: it.breakdown,
      };
    });

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (itemsErr) throw itemsErr;

    // 4) Stripe checkout line items dynamiques
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: body.customerEmail,
      line_items: pricedOrder.items.map((it) => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: itemLabel(it),
            metadata: {
              order_id: orderId,
              product_kind: it.productKind,
            },
          },
          unit_amount: it.unitHtCents, // NOTE: ça représente HT “moyen” après paliers/arrondi
        },
        quantity: it.quantity,
      })),
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart?canceled=1`,
      metadata: { order_id: orderId },
    });

    // 5) Enregistrer stripe_session_id
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderId);

    if (updErr) throw updErr;

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
