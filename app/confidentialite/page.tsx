export default function ConfidentialitePage() {
  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Politique de Confidentialité</h1>
          
          <div className="prose max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
              <p className="text-gray-700">
                ElectionPrint accorde une grande importance à la protection de vos données personnelles.
                Cette politique de confidentialité décrit comment nous collectons, utilisons et protégeons
                vos informations dans le cadre de notre service d&apos;impression électorale.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">2. Données collectées</h2>
              <p className="text-gray-700 mb-4">
                Lors de votre commande, nous collectons les données suivantes :
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Nom de la mairie et commune</li>
                <li>Adresse email et numéro de téléphone de contact</li>
                <li>Adresses de facturation et de livraison</li>
                <li>Détails de la commande (produits, quantités, options)</li>
                <li>Informations de paiement (traitées de manière sécurisée par Stripe)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">3. Utilisation des données</h2>
              <p className="text-gray-700 mb-4">
                Vos données sont utilisées pour :
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Traiter et suivre vos commandes</li>
                <li>Communiquer avec vous concernant votre commande</li>
                <li>Assurer la livraison de vos produits</li>
                <li>Émettre les factures</li>
                <li>Améliorer nos services</li>
                <li>Respecter nos obligations légales</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">4. Base légale du traitement</h2>
              <p className="text-gray-700">
                Le traitement de vos données personnelles repose sur :
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>L&apos;exécution du contrat de vente (traitement de votre commande)</li>
                <li>Le respect d&apos;obligations légales (comptabilité, facturation)</li>
                <li>Notre intérêt légitime (amélioration du service)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">5. Partage des données</h2>
              <p className="text-gray-700 mb-4">
                Vos données peuvent être partagées avec :
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Stripe :</strong> Pour le traitement sécurisé des paiements</li>
                <li><strong>Transporteurs :</strong> Pour la livraison de vos commandes</li>
                <li><strong>Prestataires techniques :</strong> Pour l&apos;hébergement et la maintenance de notre plateforme (Supabase)</li>
              </ul>
              <p className="text-gray-700 mt-4">
                Nous ne vendons jamais vos données à des tiers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">6. Conservation des données</h2>
              <p className="text-gray-700">
                Vos données sont conservées pendant la durée nécessaire aux finalités pour lesquelles
                elles ont été collectées, et conformément aux obligations légales de conservation
                (notamment comptables et fiscales - 10 ans).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">7. Sécurité</h2>
              <p className="text-gray-700">
                Nous mettons en œuvre des mesures techniques et organisationnelles appropriées
                pour protéger vos données contre tout accès non autorisé, modification, divulgation
                ou destruction. Les paiements sont traités de manière sécurisée via Stripe, conforme
                aux standards PCI-DSS.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">8. Vos droits</h2>
              <p className="text-gray-700 mb-4">
                Conformément au RGPD, vous disposez des droits suivants :
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Droit d&apos;accès :</strong> obtenir une copie de vos données</li>
                <li><strong>Droit de rectification :</strong> corriger vos données inexactes</li>
                <li><strong>Droit à l&apos;effacement :</strong> demander la suppression de vos données</li>
                <li><strong>Droit à la limitation :</strong> limiter le traitement de vos données</li>
                <li><strong>Droit d&apos;opposition :</strong> vous opposer au traitement de vos données</li>
                <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
              </ul>
              <p className="text-gray-700 mt-4">
                Pour exercer ces droits, contactez-nous à : contact@electionprint.fr
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">9. Cookies</h2>
              <p className="text-gray-700">
                Notre site utilise des cookies essentiels au fonctionnement de la plateforme
                (gestion du panier, session de paiement). Aucun cookie de tracking publicitaire
                n&apos;est utilisé.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">10. Modifications</h2>
              <p className="text-gray-700">
                Cette politique de confidentialité peut être mise à jour. Nous vous informerons
                de tout changement significatif par email ou via notre site.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">11. Contact</h2>
              <p className="text-gray-700">
                Pour toute question concernant cette politique de confidentialité ou vos données
                personnelles, contactez-nous :
              </p>
              <ul className="list-none text-gray-700 mt-4">
                <li>Email : contact@electionprint.fr</li>
                <li>Téléphone : 01 23 45 67 89</li>
                <li>Adresse : [Adresse postale]</li>
              </ul>
              <p className="text-gray-700 mt-4">
                Vous pouvez également introduire une réclamation auprès de la CNIL (Commission
                Nationale de l&apos;Informatique et des Libertés) si vous estimez que vos droits
                ne sont pas respectés.
              </p>
            </section>
          </div>

          <div className="mt-12 p-6 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">
              Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
