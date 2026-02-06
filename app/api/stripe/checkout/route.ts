import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { getServiceSupabase } from '@/lib/supabase';
import { calculateOrderTotal } from '@/lib/pricing';
import { CreateOrderPayload } from '@/types';

// Schéma de validation avec Zod
const addressSchema = z.object({
  street: z.string().min(1),
  postal_code: z.string().min(1),
  city: z.string().min(1),
  country: z.string().optional(),
});

const cartItemSchema = z.object({
  product_type: z.enum(['affiches', 'bulletins', 'professions_foi']),
  product_name: z.string(),
  options: z.record(z.string()),
  quantity: z.number().min(1),
});

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
  accept_cgv: z.boolean().refine((val) => val === true, {
    message: 'Vous devez accepter les CGV',
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Parser et valider le body
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    const { items, mairie_info, accept_cgv } = validatedData;

    // Calculer les prix côté serveur (SOURCE DE VÉRITÉ)
    const priceCalculation = await calculateOrderTotal(items);

    // Créer la commande dans Supabase (status='pending')
    const supabase = getServiceSupabase();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        status: 'pending',
        total_ht_cents: priceCalculation.subtotal_ht_cents,
        tva_rate: 20.0,
        total_ttc_cents: priceCalculation.total_ttc_cents,
        shipping_cents: priceCalculation.shipping_cents,
        currency: 'EUR',
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
      console.error('Order creation error:', orderError);
      throw new Error('Failed to create order');
    }

    // Créer les order_items
    const orderItems = priceCalculation.items.map((item) => ({
      order_id: order.id,
      product_type: item.product_type,
      product_name: item.product_name,
      options: item.options,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      line_total_cents: item.line_total_cents,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      throw new Error('Failed to create order items');
    }

    // Préparer les line items pour Stripe
    const stripeLineItems = priceCalculation.items.map((item) => ({
      price_data: {
        currency: 'eur',
        unit_amount: item.unit_price_cents,
        product_data: {
          name: item.product_name,
          description: Object.entries(item.options)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', '),
        },
      },
      quantity: item.quantity,
    }));

    // Ajouter les frais de port si nécessaire
    if (priceCalculation.shipping_cents > 0) {
      stripeLineItems.push({
        price_data: {
          currency: 'eur',
          unit_amount: priceCalculation.shipping_cents,
          product_data: {
            name: 'Frais de livraison',
            description: 'Livraison standard',
          },
        },
        quantity: 1,
      });
    }

    // Créer la session Stripe Checkout
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: stripeLineItems,
      customer_email: mairie_info.email,
      metadata: {
        order_id: order.id,
        mairie_name: mairie_info.mairie_name,
        commune: mairie_info.commune,
      },
      success_url: `${baseUrl}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/commande?canceled=1`,
      locale: 'fr',
    });

    // Mettre à jour la commande avec le session_id
    await supabase
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id);

    return NextResponse.json({ url: session.url, order_id: order.id });
  } catch (error: any) {
    console.error('Checkout error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
