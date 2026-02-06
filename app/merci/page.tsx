import { CheckCircle, Package, Mail } from 'lucide-react';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { formatCents } from '@/lib/pricing';

export default async function MerciPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;

  let order = null;
  let orderItems = [];

  if (sessionId) {
    const supabase = getServiceSupabase();

    // Récupérer la commande depuis le session_id
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .single();

    if (orderData) {
      order = orderData;

      // Récupérer les items
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      orderItems = items || [];
    }
  }

  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Success message */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Merci pour votre commande !</h1>
            <p className="text-xl text-gray-600">
              Votre paiement a été confirmé avec succès.
            </p>
          </div>

          {/* Order details */}
          {order ? (
            <div className="space-y-6">
              {/* Order info card */}
              <div className="card">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Commande confirmée</h2>
                    <p className="text-gray-600">
                      Numéro de commande: <span className="font-mono font-medium">{order.id.substring(0, 8)}</span>
                    </p>
                    <p className="text-sm text-gray-500">
                      Statut: <span className="text-green-600 font-medium">
                        {order.status === 'paid' ? 'Payée' : order.status}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-3xl font-bold text-primary-600">
                      {formatCents(order.total_ttc_cents)}
                    </p>
                  </div>
                </div>

                {/* Order items */}
                <div className="border-t pt-6">
                  <h3 className="font-bold mb-4">Articles commandés</h3>
                  <div className="space-y-3">
                    {orderItems.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-start border-b pb-3">
                        <div className="flex-1">
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-gray-600">
                            {Object.entries(item.options).map(([key, value]: [string, any]) => (
                              <span key={key} className="mr-2">
                                {key}: {value}
                              </span>
                            ))}
                          </p>
                          <p className="text-sm text-gray-600">
                            Quantité: {item.quantity} × {formatCents(item.unit_price_cents)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCents(item.line_total_cents)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-6 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Sous-total HT</span>
                      <span>{formatCents(order.total_ht_cents)}</span>
                    </div>
                    {order.shipping_cents > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Frais de livraison</span>
                        <span>{formatCents(order.shipping_cents)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">TVA (20%)</span>
                      <span>
                        {formatCents(order.total_ttc_cents - order.total_ht_cents - order.shipping_cents)}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total TTC</span>
                      <span>{formatCents(order.total_ttc_cents)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery info */}
              <div className="card">
                <h3 className="font-bold mb-4 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-primary-600" />
                  Informations de livraison
                </h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Mairie:</strong> {order.mairie_name}</p>
                  <p><strong>Commune:</strong> {order.commune}</p>
                  <p className="pt-2"><strong>Adresse de livraison:</strong></p>
                  <p>{order.shipping_address.street}</p>
                  <p>{order.shipping_address.postal_code} {order.shipping_address.city}</p>
                </div>
              </div>

              {/* Email confirmation */}
              <div className="card bg-blue-50 border-blue-200">
                <div className="flex items-start">
                  <Mail className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold mb-2">Email de confirmation</h3>
                    <p className="text-sm text-gray-700">
                      Un email de confirmation a été envoyé à{' '}
                      <span className="font-medium">{order.customer_email}</span>.
                      Il contient tous les détails de votre commande.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center">
              <p className="text-gray-600">
                Nous n&apos;avons pas pu récupérer les détails de votre commande.
                Un email de confirmation vous a été envoyé.
              </p>
            </div>
          )}

          {/* Next steps */}
          <div className="card mt-8">
            <h3 className="font-bold mb-4">Et maintenant ?</h3>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">1.</span>
                <span>Nous traitons votre commande dans les 24 heures ouvrées</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">2.</span>
                <span>Vous recevrez un email avec le numéro de suivi dès l&apos;expédition</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary-600 mr-2">3.</span>
                <span>La livraison intervient sous 3 à 5 jours ouvrés</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="text-center mt-8">
            <Link href="/" className="btn-primary inline-block">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
