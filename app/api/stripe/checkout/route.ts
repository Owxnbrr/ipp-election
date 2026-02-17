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
    return `${productLabel(item.productKind)} - ${fmt} - ${item.impression === "recto" ? "Recto" : "Recto-verso"}`;
  }
  const af = item.afficheFormat === "grand_format" ? "Grand format 594×841" : "Petit format 297×420";
  return `${productLabel(item.productKind)} - ${af}`;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = checkoutBodySchema.parse(json);

    // 1) Charger les blocs actifs
    const { data: blocks, error: blocksErr } = await supabaseAdmin
      .from("pricing_blocks")
      .select("*")
      .eq("is_active", true);

    if (blocksErr) throw blocksErr;
    const allBlocks = (blocks ?? []) as PricingBlockRow[];

    // 2) Calcul prix côté serveur (HT + TVA + TTC)
    const pricedOrder: any = priceOrder(body.items as CartItem[], allBlocks);

    // 3) Créer order en DB
    const { data: orderInsert, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        status: "pending",
        currency: "eur",
        customer_email: body.customerEmail ?? null,
        subtotal_ht_cents: pricedOrder.subtotalHtCents ?? null,
        vat_rate: pricedOrder.vatRate ?? null,
        vat_cents: pricedOrder.vatCents ?? null,
        total_ttc_cents: pricedOrder.totalTtcCents ?? null,
      })
      .select("id")
      .single();

    if (orderErr) throw orderErr;
    const orderId = orderInsert.id as string;

    // 4) Insert order_items
    const itemsRows = (pricedOrder.items ?? []).map((it: any) => {
      if (it.productKind === "professions_de_foi") {
        return {
          order_id: orderId,
          product_kind: it.productKind,
          quantity: it.quantity,
          impression: it.impression,
          bulletin_format: null,
          affiche_format: null,
          unit_ht_cents: it.unitHtCents ?? null,
          total_ht_cents: it.totalHtCents ?? null,
          pricing_breakdown: it.breakdown ?? null,
        };
      }
      if (it.productKind === "bulletins_de_vote") {
        return {
          order_id: orderId,
          product_kind: it.productKind,
          quantity: it.quantity,
          impression: it.impression,
          bulletin_format: it.bulletinFormat ?? null,
          affiche_format: null,
          unit_ht_cents: it.unitHtCents ?? null,
          total_ht_cents: it.totalHtCents ?? null,
          pricing_breakdown: it.breakdown ?? null,
        };
      }
      return {
        order_id: orderId,
        product_kind: it.productKind,
        quantity: it.quantity,
        impression: null,
        bulletin_format: null,
        affiche_format: it.afficheFormat ?? null,
        unit_ht_cents: it.unitHtCents ?? null,
        total_ht_cents: it.totalHtCents ?? null,
        pricing_breakdown: it.breakdown ?? null,
      };
    });

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (itemsErr) throw itemsErr;

    // 5) ✅ Stripe : on envoie 1 forfait TTC par ligne (quantity=1)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: body.customerEmail,
      line_items: (pricedOrder.items ?? []).map((it: any) => {
        const totalTtcCents = it.totalTtcCents ?? null;
        if (typeof totalTtcCents !== "number") {
          throw new Error("totalTtcCents manquant pour un item (Stripe).");
        }

        // On met la vraie quantité dans le nom (prix palier = forfait)
        const name = `${itemLabel(it)} — Quantité ${it.quantity}`;

        return {
          price_data: {
            currency: "eur",
            product_data: {
              name,
              metadata: { order_id: orderId, product_kind: it.productKind },
            },
            unit_amount: totalTtcCents, // ✅ TTC forfait
          },
          quantity: 1, // ✅ important pour les tarifs par palier
        };
      }),
      success_url: `${env.NEXT_PUBLIC_SITE_URL}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/commande?canceled=1`,
      metadata: { order_id: orderId },
    });

    // 6) Sauvegarde stripe_session_id
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderId);

    if (updErr) throw updErr;

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("CHECKOUT_ERROR:", err);

    // ✅ message plus lisible (Stripe / Supabase)
    const message =
      err?.message ||
      err?.error?.message ||
      err?.raw?.message ||
      "Unknown error";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
