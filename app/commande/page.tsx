// app/commande/page.tsx
import OrderForm from "@/components/OrderForm";

export default function CommandePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-10 sm:py-14">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-10 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Paiement sécurisé par Stripe
            </span>

            <h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Passer une commande
            </h1>

            <p className="mt-3 text-gray-600">
              Configurez vos documents électoraux, vérifiez le panier puis payez en carte bancaire.
            </p>
          </div>

          {/* Main card */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Votre commande</h2>
                  <p className="text-sm text-gray-600">
                    Ajoutez vos articles au panier, puis lancez le paiement.
                  </p>
                </div>

                {/* Steps */}
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white">
                      1
                    </span>
                    Configurer
                  </div>
                  <div className="hidden sm:block text-gray-300">—</div>
                  <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white">
                      2
                    </span>
                    Panier
                  </div>
                  <div className="hidden sm:block text-gray-300">—</div>
                  <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white">
                      3
                    </span>
                    Paiement
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6 sm:px-8 sm:py-8">
              <OrderForm />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            Vos informations de carte ne sont jamais stockées sur notre site.
          </p>
        </div>
      </div>
    </div>
  );
}
