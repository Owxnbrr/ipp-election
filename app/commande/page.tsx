// app/commande/page.tsx
import OrderForm from "@/components/OrderForm";

export default function CommandePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Commande en ligne
            </span>

            <h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Passer une commande
            </h1>

            <p className="mt-3 text-gray-600">
              Suivez les étapes pour configurer votre commande de documents électoraux.
            </p>
          </div>

          {/* Steps */}
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white text-sm font-semibold">
                  1
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Configurer</p>
                  <p className="text-sm text-gray-600">Produit, options, quantité</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white text-sm font-semibold">
                  2
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Panier</p>
                  <p className="text-sm text-gray-600">Vérifier les articles</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white text-sm font-semibold">
                  3
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Paiement</p>
                  <p className="text-sm text-gray-600">Carte bancaire sécurisée</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-gray-900">Détails de la commande</h2>
              <p className="mt-1 text-sm text-gray-600">
                Remplissez les informations ci-dessous, puis ajoutez au panier.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <OrderForm />
            </div>
          </div>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs text-gray-500">
            Paiement traité par Stripe. Vos informations de carte ne sont jamais stockées.
          </p>
        </div>
      </div>
    </div>
  );
}
