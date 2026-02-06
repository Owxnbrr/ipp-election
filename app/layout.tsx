import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ElectionPrint - Impression électorale pour mairies',
  description: 'Commandez vos affiches, bulletins et professions de foi électorales en ligne',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="bg-white border-b border-gray-200">
            <div className="container mx-auto px-4 py-4">
              <nav className="flex items-center justify-between">
                <Link href="/" className="text-2xl font-bold text-primary-600">
                  ElectionPrint
                </Link>
                <div className="flex items-center gap-6">
                  <Link 
                    href="/commande" 
                    className="text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    Commander
                  </Link>
                  <Link 
                    href="/cgv" 
                    className="text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    CGV
                  </Link>
                  <Link 
                    href="/confidentialite" 
                    className="text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    Confidentialité
                  </Link>
                </div>
              </nav>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-gray-900 text-gray-300 py-8 mt-20">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-white font-bold mb-4">ElectionPrint</h3>
                  <p className="text-sm">
                    Votre partenaire pour l'impression de documents électoraux.
                    Service dédié aux mairies françaises.
                  </p>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-4">Légal</h4>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <Link href="/cgv" className="hover:text-white transition-colors">
                        Conditions générales de vente
                      </Link>
                    </li>
                    <li>
                      <Link href="/confidentialite" className="hover:text-white transition-colors">
                        Politique de confidentialité
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-4">Contact</h4>
                  <p className="text-sm">
                    Email: contact@electionprint.fr<br />
                    Tél: 01 23 45 67 89
                  </p>
                </div>
              </div>
              <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
                <p>&copy; {new Date().getFullYear()} ElectionPrint. Tous droits réservés.</p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
