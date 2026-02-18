// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getServiceSupabase } from '@/lib/supabase';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  try {
    const { data: existingEvent } = await supabase
      .from('stripe_events')
      .select('id, processed')
      .eq('event_id', event.id)
      .single();

    if (existingEvent?.processed) {
      console.log('Event already processed:', event.id);
      return NextResponse.json({ received: true, already_processed: true });
    }

    if (existingEvent) {
      await supabase
        .from('stripe_events')
        .update({
          processed: true,
          data: event,
        })
        .eq('event_id', event.id);
    } else {
      await supabase
        .from('stripe_events')
        .insert({
          event_id: event.id,
          type: event.type,
          processed: false,
          data: event,
        });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);

        const orderId = session.metadata?.order_id;

        if (!orderId) {
          console.error('No order_id in session metadata');
          break;
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'paid',
            stripe_payment_intent_id: session.payment_intent as string,
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Failed to update order:', updateError);
          throw updateError;
        }

        console.log('Order marked as paid:', orderId);

        await supabase
          .from('stripe_events')
          .update({ processed: true })
          .eq('event_id', event.id);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent succeeded:', paymentIntent.id);

        await supabase
          .from('stripe_events')
          .update({ processed: true })
          .eq('event_id', event.id);

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent failed:', paymentIntent.id);
        await supabase
          .from('stripe_events')
          .update({ processed: true })
          .eq('event_id', event.id);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
        await supabase
          .from('stripe_events')
          .update({ processed: true })
          .eq('event_id', event.id);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
