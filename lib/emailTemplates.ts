// lib/emailTemplates.ts
type FileLink = { name: string; url: string };

export function customerEmailHtml(params: {
  orderId: string;
  totalTtcCents: number;
  files: FileLink[];
}) {
  const euros = (params.totalTtcCents / 100).toFixed(2).replace(".", ",");
  const items = params.files
    .map(
      (f) =>
        `<li style="margin:8px 0;"><a href="${f.url}" target="_blank" rel="noreferrer">${escapeHtml(
          f.name
        )}</a></li>`
    )
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;line-height:1.5">
    <h2>Confirmation de commande</h2>
    <p>Merci ! Votre paiement a bien été reçu.</p>
    <p><b>Commande :</b> ${escapeHtml(params.orderId)}</p>
    <p><b>Total TTC :</b> ${euros} €</p>

    <h3>Vos fichiers (liens valables 30 jours)</h3>
    <ul>${items || "<li>Aucun fichier</li>"}</ul>

    <p style="margin-top:18px;color:#666;font-size:12px">
      Si vous avez un souci, répondez à ce mail.
    </p>
  </div>
  `;
}

export function adminEmailHtml(params: {
  orderId: string;
  customerEmail: string | null;
  totalTtcCents: number;
  files: FileLink[];
}) {
  const euros = (params.totalTtcCents / 100).toFixed(2).replace(".", ",");
  const items = params.files
    .map(
      (f) =>
        `<li style="margin:8px 0;"><a href="${f.url}" target="_blank" rel="noreferrer">${escapeHtml(
          f.name
        )}</a></li>`
    )
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;line-height:1.5">
    <h2>Nouvelle commande payée</h2>
    <p><b>Commande :</b> ${escapeHtml(params.orderId)}</p>
    <p><b>Client :</b> ${escapeHtml(params.customerEmail ?? "—")}</p>
    <p><b>Total TTC :</b> ${euros} €</p>

    <h3>Fichiers (liens valables 30 jours)</h3>
    <ul>${items || "<li>Aucun fichier</li>"}</ul>
  </div>
  `;
}

function escapeHtml(str: string) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
