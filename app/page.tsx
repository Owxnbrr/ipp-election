import Link from 'next/link';
import { Printer, FileText, Newspaper } from 'lucide-react';

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">
            Impression électorale pour mairies
          </h1>
          <p className="text-xl mb-8 text-primary-100 max-w-2xl mx-auto">
            Commandez en ligne vos affiches, bulletins de vote et professions de foi.
            Paiement sécurisé, livraison rapide.
          </p>
          <Link href="/commande" className="btn-primary inline-block text-lg">
            Commencer ma commande
          </Link>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Nos produits électoraux
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Affiches */}
            <div className="card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <Newspaper className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Affiches électorales</h3>
              <p className="text-gray-600 mb-4">
                Formats A3, A2, A1. Couleur ou N&B. Papier standard ou premium.
                Finition pelliculage disponible.
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>✓ Formats variés</li>
                <li>✓ Haute qualité d'impression</li>
                <li>✓ Finition professionnelle</li>
              </ul>
            </div>

            {/* Bulletins */}
            <div className="card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Bulletins de vote</h3>
              <p className="text-gray-600 mb-4">
                Formats A6 ou A5. Conformes aux normes électorales.
                Papier standard ou épais.
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>✓ Conformes aux normes</li>
                <li>✓ Papier de qualité</li>
                <li>✓ Production rapide</li>
              </ul>
            </div>

            {/* Professions de foi */}
            <div className="card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <Printer className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Professions de foi</h3>
              <p className="text-gray-600 mb-4">
                Formats A4 ou A5. Couleur ou N&B. Option pliage disponible.
                Papier premium.
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>✓ Formats adaptés</li>
                <li>✓ Pliage professionnel</li>
                <li>✓ Rendu soigné</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-100">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Comment ça marche ?
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-bold mb-2">Choisissez vos produits</h3>
              <p className="text-gray-600 text-sm">
                Sélectionnez les options et quantités
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-bold mb-2">Renseignez vos infos</h3>
              <p className="text-gray-600 text-sm">
                Coordonnées et adresses de livraison
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-bold mb-2">Validez et payez</h3>
              <p className="text-gray-600 text-sm">
                Paiement sécurisé par carte bancaire
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="font-bold mb-2">Recevez votre commande</h3>
              <p className="text-gray-600 text-sm">
                Livraison rapide à votre mairie
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Prêt à commander ?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Notre système en ligne facilite vos commandes de documents électoraux.
            Commencez dès maintenant.
          </p>
          <Link href="/commande" className="btn-primary inline-block text-lg">
            Passer une commande
          </Link>
        </div>
      </section>
    </div>
  );
}
