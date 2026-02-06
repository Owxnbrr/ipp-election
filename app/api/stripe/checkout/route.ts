import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { getServiceSupabase } from "@/lib/supabase";
import { calculateOrderTotal } from "@/lib/pricing";
import type { CartItem } from "@/types";

const addressSchema = z.object({
  street: z.string().min(1),
  postal_code: z.string().min(1),
  city: z.string().min(1),
  country: z.string().optional(),
});

const affichesOptionsSchema = z.object({
  format: z.string().min(1),
  couleur: z.string().min(1),
  papier: z.string().min(1),
  finition: z.string().min(1),
});

const bulletinsOptionsSchema = z.object({
  format: z.string().min(1),
  couleur: z.string().min(1),
  papier: z.string().min(1),
});

const professionsFoiOptionsSchema = z.object({
  format: z.string().min(1),
  couleur: z.string().min(1),
  papier: z.string().min(1),
  pliage: z.string().min(1),
});

const cartItemSchema = z.discriminatedUnion("product_type", [
  z.object({
    product_type: z.literal("affiches"),
    product_name: z.string().min(1),
    options: affichesOptionsSchema,
    quantity: z.number().int().min(1),
  }),
  z.object({
    product_type: z.literal("bulletins"),
    product_name: z.string().min(1),
    options: bulletinsOptionsSchema,
    quantity: z.number().int().min(1),
  }),
  z.object({
    product_type: z.literal("professions_foi"),
    product_name: z.string().min(1),
    options: professionsFoiOptionsSchema,
    quantity: z.number().int().min(1),
  }),
]);

const requestSchema = z.object({
  items: z.array(cartItemSchema).min(1),
  mairie_info: z.object({
    mairie_name: z.string().min(1),
    commune: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    billing_address: addressSchema,
    shipping_address: addressSchema,
  }),
  accept_cgv: z.literal(true),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    const { items, mairie_info } = validatedData;

    const typedItems = items as unknown as CartItem[];

    const priceCalculation = await calculateOrderTotal(typedItems);

    const supabase = getServiceSupabase();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        status: "pending",
        total_ht_cents: priceCalculation.subtotal_ht_cents,
        tva_rate: 0,
        total_ttc_cents: priceCalculation.total_ttc_cents,
        shipping_cents: priceCalculation.shipping_cents,
        currency: "EUR",
        customer_email: mairie_info.email,
        customer_phone: mairie_info.phone,
        mairie_name: mairie_info.mairie_name,
        commune: mairie_info.commune,
        billing_address: mairie_info.billing_address,
        shipping_address: mairie_info.shipping_address,
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error("Failed to create order");
    }

    const orderItems = priceCalculation.items.map((item) => ({
      order_id: order.id,
      product_type: item.product_type,
      product_name: item.product_name,
      options: item.options,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      line_total_cents: item.line_total_cents,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

    if (itemsError) {
      throw new Error("Failed to create order items");
    }

    const stripeLineItems = priceCalculation.items.map((item) => ({
      price_data: {
        currency: "eur",
        unit_amount: item.unit_price_cents,
        product_data: {
          name: item.product_name,
          description: Object.entries({ ...item.options })
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join(", "),
        },
      },
      quantity: item.quantity,
    }));

    if (priceCalculation.shipping_cents > 0) {
      stripeLineItems.push({
        price_data: {
          currency: "eur",
          unit_amount: priceCalculation.shipping_cents,
          product_data: {
            name: "Frais de livraison",
            description: "Livraison standard",
          },
        },
        quantity: 1,
      });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.BASE_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: stripeLineItems,
      customer_email: mairie_info.email,
      metadata: {
        order_id: order.id,
        mairie_name: mairie_info.mairie_name,
        commune: mairie_info.commune,
      },
      success_url: `${baseUrl}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/commande?canceled=1`,
      locale: "fr",
    });

    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

    return NextResponse.json({ url: session.url, order_id: order.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: error?.message || "Une erreur est survenue" }, { status: 500 });
  }
}
