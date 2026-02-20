import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import CookieBanner from "@/components/CookieBanner";
import Image from "next/image";


const inter = Inter({ subsets: ['latin'] });


export const metadata: Metadata = {
  title: 'IPP - Impression électorale pour mairies',
  description: 'Commandez vos affiches, bulletins et professions de foi électorales en ligne',
  icons: {
    icon: "/favicon.png",
  },
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
          <header className="bg-white border-b border-gray-200">
            <div className="container mx-auto px-4 py-4">
              <nav className="flex items-center justify-between">
                <a href="/"><img className="h-10 w-auto" src="/img/logo.png" alt="logo ipp" /></a>
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

          <main className="flex-1">
            {children}
              <CookieBanner />
          </main>

          <footer className="bg-gray-900 text-gray-300 py-8 mt-20">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-3 gap-8">
                <div>
                <img className="h-10 w-auto" src="/img/Fichier-3.webp" alt="logo ipp" />
                  <p className="text-sm">
                    Votre partenaire pour l&apos;impression de documents électoraux.
                    Service dédié aux mairies françaises.
                  </p>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-4">Légal</h4>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <Link
                        href="/cgv"
                        className="relative inline-block hover:text-white transition-colors after:absolute after:left-0 after:-bottom-0.5 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 hover:after:scale-x-100"
                      >
                        Conditions générales de vente
                      </Link>
                    </li>
                    <li>
                      <Link href="/confidentialite" className="relative inline-block hover:text-white transition-colors after:absolute after:left-0 after:-bottom-0.5 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 hover:after:scale-x-100">
                        Politique de confidentialité
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-4">Contact</h4>
                  <p className="text-sm">
                    Email: contact@ipp-imprimerie.fr<br />
                    Tél: 03 22 78 01 25<br />
                    Adresse: 6 rue Dupuy, 80500 Montdidier
                  </p>
                </div>
              </div>
              <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
                <p>&copy; {new Date().getFullYear()} IPP. Tous droits réservés.</p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
