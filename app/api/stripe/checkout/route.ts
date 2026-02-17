// app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { CartItem, PricingBlockRow } from "@/types";
import { priceOrder } from "@/lib/pricing";

// ✅ IMPORTANT : ne mets pas apiVersion ici (ça te créait l'erreur TS)
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** -----------------------
 * ZOD: validation body
 * ---------------------- */
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

/** -----------------------
 * Helpers
 * ---------------------- */
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
  return it.productKind !== "affiches" ? it.impression : null;
}
function afficheFormatOrNull(it: CartItem) {
  return it.productKind === "affiches" ? it.afficheFormat : null;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = bodySchema.parse(json);

    // 1) Charge les blocs actifs (source de vérité)
    const { data: blocks, error: blocksErr } = await supabaseAdmin
      .from("pricing_blocks")
      .select("*")
      .eq("is_active", true);

    if (blocksErr) throw blocksErr;
    const allBlocks = (blocks ?? []) as PricingBlockRow[];

    // 2) Pricing serveur (HT + TVA + TTC) -> ✅ camelCase uniquement
    const priced = priceOrder(body.items as CartItem[], allBlocks);

    const pricedItems = priced.items ?? [];
    const subtotalHtCents = safeInt(priced.subtotalHtCents, 0);
    const vatCents = safeInt(priced.vatCents, 0);
    const totalTtcCents = safeInt(priced.totalTtcCents, subtotalHtCents + vatCents);

    // Sécurité : jamais 0 si panier non vide (évite null / NaN)
    if (!pricedItems.length || totalTtcCents <= 0) {
      return NextResponse.json({ error: "Prix invalide (pricing serveur)." }, { status: 400 });
    }

    // 3) Crée la commande en DB (orders) AVANT Stripe
    // ✅ Remplir les champs NOT NULL
    const orderPayload: any = {
      status: "pending",
      currency: "eur",
      customer_email: body.customerEmail ?? null,

      // Champs importants (NOT NULL chez toi)
      total_ht_cents: subtotalHtCents,
      total_ttc_cents: totalTtcCents,

      // Si ta DB utilise aussi ces champs :
      subtotal_ht_cents: subtotalHtCents,
      vat_cents: vatCents,

      // champs "rate" au niveau order: si tu as mix TVA, on met 0 (évite undefined)
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

    // 4) Insert order_items avec tous les champs sensibles NOT NULL
    const itemsRows = (body.items as CartItem[]).map((it, idx) => {
      const p = pricedItems[idx];

      const itemHt = safeInt(p?.totalHtCents, 0);
      const itemVat = safeInt(p?.vatCents, 0);
      const itemTtc = safeInt(p?.totalTtcCents, itemHt + itemVat);

      // TVA rate par item (si dispo)
      const vatRate = typeof p?.vatRate === "number" ? p.vatRate : null;

      return {
        order_id: orderId,

        // ✅ NOT NULL chez toi
        product_type: it.productKind, // ex: "professions_de_foi"
        quantity: it.quantity, // int
        unit_price_cents: itemTtc, // on stocke le TTC comme "prix unitaire" de la ligne
        line_total_cents: itemTtc, // idem (si tu charges la ligne en 1 seul bloc)

        // Champs détaillés (tu les as dans ta table)
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

        // ✅ ton pricing.ts renvoie "breakdown"
        pricing_breakdown: p?.breakdown ?? null,
      };
    });

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (itemsErr) throw itemsErr;

    // 5) Stripe line_items : on charge chaque item TTC (quantité = 1)
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = (body.items as CartItem[]).map((it, idx) => {
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
          unit_amount: itemTtc, // ✅ TTC (avec TVA)
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

    // 6) Crée la session Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: body.customerEmail,
      line_items,
      success_url: `${env.BASE_URL}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.BASE_URL}/commande?canceled=1`,
      metadata: {
        order_id: orderId,
      },
    });

    // 7) Sauvegarde l’id de session Stripe dans orders
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
