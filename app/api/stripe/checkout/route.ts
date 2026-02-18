import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { CartItem, PricingBlockRow } from "@/types";
import { priceOrder } from "@/lib/pricing";

export const runtime = "nodejs";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

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

const bodySchema = z.union([
  z.object({ orderId: z.string().min(1) }),
  z.object({
    customerEmail: z.string().email().optional(),
    items: z.array(cartItemSchema).min(1),
  }),
]);

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
    const json = await req.json();
    const body = bodySchema.parse(json);
    if ("orderId" in body) {
      const orderId = body.orderId;

      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .select("id, customer_email")
        .eq("id", orderId)
        .single();
      if (orderErr) throw orderErr;

      const { data: items, error: itemsErr } = await supabaseAdmin
        .from("order_items")
        .select("product_name, quantity, unit_ht_cents, vat_cents, total_ttc_cents, vat_rate")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (itemsErr) throw itemsErr;

      if (!items?.length) {
        return NextResponse.json({ error: "Aucun item en DB pour cette commande." }, { status: 400 });
      }

      const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((it: any) => {
        const itemHt = safeInt(it.unit_ht_cents, 0);
        const itemVat = safeInt(it.vat_cents, 0);
        const itemTtc = safeInt(it.total_ttc_cents, itemHt + itemVat);
        const vatRate = typeof it.vat_rate === "number" ? it.vat_rate : null;

        return {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: itemTtc,
            product_data: {
              name: it.product_name ?? "Article",
              description: `Quantité: ${it.quantity} • HT: ${(itemHt / 100).toFixed(2)}€ • TVA: ${(itemVat / 100).toFixed(
                2
              )}€${vatRate != null ? ` (${(vatRate * 100).toFixed(1).replace(".", ",")}%)` : ""}`,
            },
          },
        };
      });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: order.customer_email ?? undefined,
        line_items,
        success_url: `${env.BASE_URL}/merci?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.BASE_URL}/commande?canceled=1`,
        metadata: { order_id: orderId },
      });

      const { error: updErr } = await supabaseAdmin
        .from("orders")
        .update({ stripe_session_id: session.id })
        .eq("id", orderId);
      if (updErr) throw updErr;

      return NextResponse.json({ url: session.url }, { status: 200 });
    }
    const { customerEmail, items } = body;

    const { data: blocks, error: blocksErr } = await supabaseAdmin
      .from("pricing_blocks")
      .select("*")
      .eq("is_active", true);
    if (blocksErr) throw blocksErr;
    const allBlocks = (blocks ?? []) as PricingBlockRow[];

    const priced = priceOrder(items as CartItem[], allBlocks);

    const pricedItems = priced.items ?? [];
    const subtotalHtCents = safeInt(priced.subtotalHtCents, 0);
    const vatCents = safeInt(priced.vatCents, 0);
    const totalTtcCents = safeInt(priced.totalTtcCents, subtotalHtCents + vatCents);

    if (!pricedItems.length || totalTtcCents <= 0) {
      return NextResponse.json({ error: "Prix invalide (pricing serveur)." }, { status: 400 });
    }

    const orderPayload: any = {
      status: "pending",
      currency: "eur",
      customer_email: customerEmail ?? null,
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

    const itemsRows = (items as CartItem[]).map((it, idx) => {
      const p = pricedItems[idx];
      const itemHt = safeInt(p?.totalHtCents, 0);
      const itemVat = safeInt(p?.vatCents, 0);
      const itemTtc = safeInt(p?.totalTtcCents, itemHt + itemVat);
      const vatRate = typeof p?.vatRate === "number" ? p.vatRate : null;

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
        pricing_breakdown: p?.breakdown ?? null,
      };
    });

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (itemsErr) throw itemsErr;

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = (items as CartItem[]).map((it, idx) => {
      const p = pricedItems[idx];
      const itemHt = safeInt(p?.totalHtCents, 0);
      const itemVat = safeInt(p?.vatCents, 0);
      const itemTtc = safeInt(p?.totalTtcCents, itemHt + itemVat);
      const vatRate = typeof p?.vatRate === "number" ? p.vatRate : null;

      const label = labelItem(it);

      return {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: itemTtc,
          product_data: {
            name: label,
            description: `Quantité: ${it.quantity} • HT: ${(itemHt / 100).toFixed(
              2
            )}€ • TVA: ${(itemVat / 100).toFixed(2)}€${
              vatRate != null ? ` (${(vatRate * 100).toFixed(1).replace(".", ",")}%)` : ""
            }`,
          },
        },
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail,
      line_items,
      success_url: `${env.BASE_URL}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.BASE_URL}/commande?canceled=1`,
      metadata: { order_id: orderId },
    });

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
