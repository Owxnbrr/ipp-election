// app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { CartItem, PricingBlockRow } from "@/types";
import { priceOrder } from "@/lib/pricing";

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

const bodySchema = z.object({
  customerEmail: z.string().email().optional(),
  items: z.array(cartItemSchema).min(1),
});

function vatRateForItem(item: CartItem): number {
  // ✅ TVA demandée:
  // professions + bulletins: 5.5%
  // affiches: 20%
  if (item.productKind === "affiches") return 0.2;
  return 0.055;
}

function labelItem(item: CartItem): string {
  if (item.productKind === "professions_de_foi") {
    return `Professions de foi • ${item.impression === "recto" ? "Recto" : "Recto-verso"}`;
  }
  if (item.productKind === "bulletins_de_vote") {
    const fmt = item.bulletinFormat === "liste_5_31" ? "Liste 5–31" : "Liste 32+";
    return `Bulletins de vote • ${fmt} • ${item.impression === "recto" ? "Recto" : "Recto-verso"}`;
  }
  return `Affiches • ${item.afficheFormat === "grand_format" ? "Grand format 594×841" : "Petit format 297×420"}`;
}

function safeInt(n: unknown, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : fallback;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = bodySchema.parse(json);

    // 1) Récupérer les paliers actifs
    const { data: blocks, error: blocksError } = await supabaseAdmin
      .from("pricing_blocks")
      .select("*")
      .eq("is_active", true);

    if (blocksError) throw blocksError;

    const allBlocks = (blocks ?? []) as PricingBlockRow[];

    // 2) Calcul HT (source de vérité)
    const pricedOrder = priceOrder(body.items as CartItem[], allBlocks);

    // 3) Ajouter TVA + TTC sur chaque item + total
    const enrichedItems = (pricedOrder.items ?? []).map((it: any) => {
      const qty = safeInt(it.quantity, 0);
      const totalHtCents = safeInt(it.totalHtCents ?? it.total_ht_cents, 0);

      // ⚠️ on retrouve le CartItem original pour savoir la TVA
      const original = body.items.find((x) => {
        // match “structurel” (ok pour ce projet)
        if (x.productKind !== it.productKind) return false;
        if (x.productKind === "affiches") return (x as any).afficheFormat === it.afficheFormat && x.quantity === it.quantity;
        if (x.productKind === "professions_de_foi") return (x as any).impression === it.impression && x.quantity === it.quantity;
        if (x.productKind === "bulletins_de_vote")
          return (
            (x as any).impression === it.impression &&
            (x as any).bulletinFormat === it.bulletinFormat &&
            x.quantity === it.quantity
          );
        return false;
      }) as CartItem | undefined;

      const rate = vatRateForItem(original ?? (it as CartItem));
      const vatCents = Math.round(totalHtCents * rate);
      const totalTtcCents = totalHtCents + vatCents;

      const unitPriceHtCents = qty > 0 ? Math.round(totalHtCents / qty) : 0;

      return {
        ...it,
        vatRate: rate,
        totalHtCents,
        vatCents,
        totalTtcCents,
        unitPriceHtCents,
      };
    });

    const subtotalHtCents = enrichedItems.reduce((s: number, x: any) => s + safeInt(x.totalHtCents), 0);
    const vatCents = enrichedItems.reduce((s: number, x: any) => s + safeInt(x.vatCents), 0);
    const totalTtcCents = subtotalHtCents + vatCents;

    // 4) Créer la commande en DB (orders)
    const { data: orderInsert, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        status: "pending",
        total_ht_cents: subtotalHtCents,
        vat_cents: vatCents,
        total_ttc_cents: totalTtcCents,
        // si tu veux garder une info globale (optionnelle)
        tva_rate: null,
      })
      .select("id")
      .single();

    if (orderError) throw orderError;

    const orderId = orderInsert.id as string;

    // 5) Insérer les lignes (order_items) - ZÉRO NULL sur NOT NULL
    const itemsRows = enrichedItems.map((it: any) => {
      const qty = safeInt(it.quantity, 0);

      return {
        order_id: orderId,

        product_type: it.productKind,
        product_name: labelItem(it as CartItem),

        quantity: qty,

        // ✅ requis (chez toi c'est NOT NULL)
        unit_price_cents: safeInt(it.unitPriceHtCents, 0),

        // ✅ colonnes ajoutées via SQL plus haut
        total_ht_cents: safeInt(it.totalHtCents, 0),
        vat_cents: safeInt(it.vatCents, 0),
        total_ttc_cents: safeInt(it.totalTtcCents, 0),
        vat_rate: typeof it.vatRate === "number" ? it.vatRate : null,

        options: {
          impression: it.productKind !== "affiches" ? it.impression : null,
          bulletin_format: it.productKind === "bulletins_de_vote" ? it.bulletinFormat : null,
          affiche_format: it.productKind === "affiches" ? it.afficheFormat : null,
        },
      };
    });

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (itemsError) throw itemsError;

    // 6) Stripe Checkout: on facture TTC
    // ✅ pour éviter des qty énormes (50000 etc), on met quantity=1 et unit_amount = total TTC de la ligne
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = enrichedItems.map((it: any) => {
      const label = labelItem(it as CartItem);
      const qty = safeInt(it.quantity, 0);

      return {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: safeInt(it.totalTtcCents, 0), // ✅ TTC
          product_data: {
            name: label,
            description: `Quantité : ${qty} • HT ${Math.round(it.totalHtCents) / 100}€ • TVA ${(it.vatRate * 100).toFixed(1).replace(".", ",")}%`,
          },
        },
      };
    });

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

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("CHECKOUT_ERROR:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
