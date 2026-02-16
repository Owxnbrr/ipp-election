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
  const af =
    item.afficheFormat === "grand_format" ? "Grand format 594×841" : "Petit format 297×420";
  return `${productLabel(item.productKind)} - ${af}`;
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ");
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const anyErr = err as any;
    if (typeof anyErr.message === "string") return anyErr.message;
    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown error";
    }
  }
  return "Unknown error";
}

function safeErrorDetails(err: unknown): Record<string, unknown> | undefined {
  if (!err || typeof err !== "object") return undefined;
  const anyErr = err as any;

  const details: Record<string, unknown> = {};
  for (const k of ["name", "type", "code", "statusCode", "param", "details", "hint"]) {
    if (anyErr[k] != null) details[k] = anyErr[k];
  }

  if (anyErr.raw && typeof anyErr.raw === "object") {
    details.raw = {
      message: anyErr.raw.message,
      type: anyErr.raw.type,
      code: anyErr.raw.code,
      param: anyErr.raw.param,
      request_log_url: anyErr.raw.request_log_url,
    };
  }

  return Object.keys(details).length ? details : undefined;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = checkoutBodySchema.parse(json);

    // 1) Load pricing blocks
    const { data: blocks, error: blocksErr } = await supabaseAdmin
      .from("pricing_blocks")
      .select("*")
      .eq("is_active", true);

    if (blocksErr) throw blocksErr;

    const allBlocks = (blocks ?? []) as PricingBlockRow[];

    // 2) Server pricing
    const pricedOrder = priceOrder(body.items, allBlocks, 0.2);

    // 3) Create order
    // IMPORTANT: ton schéma a total_ht_cents NOT NULL + tva_rate
    const { data: orderInsert, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        status: "pending",
        currency: "eur",
        customer_email: body.customerEmail ?? null,

        // ✅ compat schéma actuel
        total_ht_cents: pricedOrder.subtotalHtCents,
        tva_rate: pricedOrder.vatRate,
        total_ttc_cents: pricedOrder.totalTtcCents,

        // ✅ colonnes "nouveau schéma" si elles existent chez toi (ok si nullable)
        subtotal_ht_cents: pricedOrder.subtotalHtCents,
        vat_rate: pricedOrder.vatRate,
        vat_cents: pricedOrder.vatCents,
      })
      .select("id")
      .single();

    if (orderErr) throw orderErr;
    const orderId = orderInsert.id as string;

    // 4) Create order_items (compat legacy + new)
    const itemsRows = pricedOrder.items.map((it) => {
      const name = itemLabel(it);

      const options =
        it.productKind === "professions_de_foi"
          ? { impression: it.impression }
          : it.productKind === "bulletins_de_vote"
            ? { impression: it.impression, bulletinFormat: it.bulletinFormat }
            : { afficheFormat: it.afficheFormat };

      // legacy unit
      const legacyUnit = Math.round(it.totalHtCents / it.quantity);

      if (it.productKind === "professions_de_foi") {
        return {
          order_id: orderId,

          // legacy
          product_type: it.productKind,
          product_name: name,
          options,
          unit_price_cents: legacyUnit,
          line_total_cents: it.totalHtCents,

          // new
          product_kind: it.productKind,
          quantity: it.quantity,
          impression: it.impression,
          bulletin_format: null,
          affiche_format: null,
          unit_ht_cents: legacyUnit,
          total_ht_cents: it.totalHtCents,
          pricing_breakdown: it.breakdown,
        };
      }

      if (it.productKind === "bulletins_de_vote") {
        return {
          order_id: orderId,

          // legacy
          product_type: it.productKind,
          product_name: name,
          options,
          unit_price_cents: legacyUnit,
          line_total_cents: it.totalHtCents,

          // new
          product_kind: it.productKind,
          quantity: it.quantity,
          impression: it.impression,
          bulletin_format: it.bulletinFormat,
          affiche_format: null,
          unit_ht_cents: legacyUnit,
          total_ht_cents: it.totalHtCents,
          pricing_breakdown: it.breakdown,
        };
      }

      // affiches
      return {
        order_id: orderId,

        // legacy
        product_type: it.productKind,
        product_name: name,
        options,
        unit_price_cents: legacyUnit,
        line_total_cents: it.totalHtCents,

        // new
        product_kind: it.productKind,
        quantity: it.quantity,
        impression: null,
        bulletin_format: null,
        affiche_format: it.afficheFormat,
        unit_ht_cents: legacyUnit,
        total_ht_cents: it.totalHtCents,
        pricing_breakdown: it.breakdown,
      };
    });

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (itemsErr) throw itemsErr;

    // 5) Stripe checkout (montant exact : 1 ligne / item)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: body.customerEmail,
      line_items: pricedOrder.items.map((it) => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: itemLabel(it),
            metadata: { order_id: orderId, product_kind: it.productKind },
          },
          unit_amount: it.totalHtCents, // ✅ total exact HT
        },
        quantity: 1,
      })),
      success_url: `${env.NEXT_PUBLIC_SITE_URL}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/commande?canceled=1`,
      metadata: { order_id: orderId },
    });

    // 6) Save stripe session id
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderId);

    if (updErr) throw updErr;

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: unknown) {
    console.error("CHECKOUT_ERROR RAW:", err);
    const message = safeErrorMessage(err);
    const details = safeErrorDetails(err);
    return NextResponse.json({ error: message, details }, { status: 400 });
  }
}
