export default function CGVPage() {
  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Conditions Générales de Vente</h1>
          
          <div className="prose max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4">1. Objet</h2>
              <p className="text-gray-700">
                Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles
                entre ElectionPrint et les mairies clientes pour la fourniture de services d&apos;impression
                de documents électoraux (affiches, bulletins de vote, professions de foi).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">2. Commandes</h2>
              <p className="text-gray-700 mb-4">
                Les commandes sont passées en ligne via notre plateforme. Toute commande implique
                l&apos;acceptation sans réserve des présentes CGV.
              </p>
              <p className="text-gray-700">
                Une fois la commande validée et le paiement effectué, un email de confirmation
                est envoyé au client contenant le récapitulatif de la commande.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">3. Prix</h2>
              <p className="text-gray-700 mb-4">
                Les prix sont indiqués en euros (€) toutes taxes comprises (TTC). Ils incluent
                la TVA au taux en vigueur (20%).
              </p>
              <p className="text-gray-700">
                Les frais de livraison sont calculés en fonction du montant de la commande et
                sont indiqués avant validation du paiement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">4. Paiement</h2>
              <p className="text-gray-700 mb-4">
                Le paiement s&apos;effectue en ligne par carte bancaire via notre système de paiement
                sécurisé Stripe. Le paiement est requis au moment de la commande.
              </p>
              <p className="text-gray-700">
                Aucune commande ne sera traitée avant la confirmation du paiement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">5. Livraison</h2>
              <p className="text-gray-700 mb-4">
                Les délais de livraison sont de 3 à 5 jours ouvrés à compter de la validation
                de la commande. Ces délais sont donnés à titre indicatif.
              </p>
              <p className="text-gray-700">
                La livraison s&apos;effectue à l&apos;adresse indiquée lors de la commande. Le client
                doit vérifier l&apos;état du colis à la réception et signaler toute anomalie dans
                les 48 heures.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">6. Droit de rétractation</h2>
              <p className="text-gray-700">
                En raison de la nature personnalisée des produits (documents électoraux imprimés
                selon vos spécifications), le droit de rétractation ne peut s&apos;appliquer conformément
                à l&apos;article L221-28 du Code de la consommation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">7. Garanties et responsabilité</h2>
              <p className="text-gray-700 mb-4">
                Nous nous engageons à fournir des produits conformes aux normes en vigueur pour
                les documents électoraux. En cas de défaut de conformité, le client dispose d&apos;un
                délai de 48 heures pour nous en informer.
              </p>
              <p className="text-gray-700">
                Notre responsabilité est limitée au remboursement ou au remplacement des produits
                défectueux.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">8. Données personnelles</h2>
              <p className="text-gray-700">
                Les données personnelles collectées lors de la commande sont nécessaires au
                traitement de celle-ci. Pour plus d&apos;informations, consultez notre{' '}
                <a href="/confidentialite" className="text-primary-600 underline">
                  politique de confidentialité
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">9. Droit applicable</h2>
              <p className="text-gray-700">
                Les présentes CGV sont soumises au droit français. Tout litige relatif à leur
                interprétation ou leur exécution relève de la compétence des tribunaux français.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">10. Contact</h2>
              <p className="text-gray-700">
                Pour toute question concernant nos CGV, vous pouvez nous contacter à l&apos;adresse
                suivante : contact@electionprint.fr ou par téléphone au 01 23 45 67 89.
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
