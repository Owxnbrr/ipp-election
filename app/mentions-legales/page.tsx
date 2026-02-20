export const metadata = {
  title: "Mentions légales",
};

export default function MentionsLegalesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Mentions légales</h1>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Éditeur du site</h2>
        <p>
          Le site <strong>ipp-election</strong> est édité par la société{" "}
          <strong>IPP COM</strong>, société par actions simplifiée (SAS), au capital de{" "}
          <strong>1 100,00 €</strong>, dont le siège social est situé{" "}
          <strong>6 rue Jean Dupuy, 80500 Montdidier, France</strong>.
        </p>

        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>SIREN :</strong> 790 798 292
          </li>
          <li>
            <strong>SIRET (siège) :</strong> 790 798 292 00013
          </li>
          <li>
            <strong>RCS :</strong> Amiens
          </li>
          <li>
            <strong>Code APE/NAF :</strong> 70.21Z — Conseil en relations publiques et
            communication
          </li>
          <li>
            <strong>TVA intracommunautaire :</strong> FR25 790798292
          </li>
          <li>
            <strong>Directeur de la publication :</strong> Bucheton Noah
          </li>
          <li>
            <strong>Téléphone :</strong> 03 22 78 01 25
          </li>
          <li>
            <strong>Email :</strong>{" "}
            <a className="underline" href="mailto:contact@ipp-imprimerie.fr">
              contact@ipp-imprimerie.fr
            </a>
          </li>
          <li>
            <strong>Adresse postale :</strong> 6 rue Jean Dupuy, 80500 Montdidier, France
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">Hébergement</h2>
        <p>
          Le site est hébergé par <strong>Netlify, Inc.</strong> (à compléter avec les
          coordonnées officielles de l’hébergeur si nécessaire).
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">Propriété intellectuelle</h2>
        <p>
          Les contenus (textes, images, logos, etc.) présents sur ce site sont protégés
          par le Code de la propriété intellectuelle. Toute reproduction, représentation,
          modification, publication, adaptation, totale ou partielle, est interdite sans
          autorisation écrite préalable de IPP COM.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">Responsabilité</h2>
        <p>
          IPP COM met en œuvre des moyens raisonnables pour assurer l’exactitude et la
          mise à jour des informations publiées. Toutefois, IPP COM ne saurait être tenue
          responsable des erreurs, omissions, ou de l’utilisation qui pourrait être faite
          des informations disponibles sur le site.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">Données personnelles</h2>
        <p>
          Le traitement de vos données personnelles est réalisé conformément au RGPD.
          Pour plus d’informations, consultez la{" "}
          <a className="underline" href="/confidentialite">
            politique de confidentialité
          </a>
          .
        </p>
        <p>
          Pour exercer vos droits (accès, rectification, suppression, opposition,
          limitation) :{" "}
          <a className="underline" href="mailto:contact@ipp-imprimerie.fr">
            contact@ipp-imprimerie.fr
          </a>
          .
        </p>
      </section>
    </main>
  );
}