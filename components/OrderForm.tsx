// OrderForm.tsx
"use client";

import { useMemo, useState } from "react";
import type { CartItem, ProductKind, ImpressionType, BulletinFormat, AfficheFormat } from "@/types";

const productKinds: { value: ProductKind; label: string }[] = [
  { value: "professions_de_foi", label: "Professions de foi" },
  { value: "bulletins_de_vote", label: "Bulletins de vote" },
  { value: "affiches", label: "Affiches" },
];

export default function OrderForm() {
  const [productKind, setProductKind] = useState<ProductKind>("professions_de_foi");
  const [quantity, setQuantity] = useState<number>(100);

  const [impression, setImpression] = useState<ImpressionType>("recto");
  const [bulletinFormat, setBulletinFormat] = useState<BulletinFormat>("liste_5_31");
  const [afficheFormat, setAfficheFormat] = useState<AfficheFormat>("grand_format");

  const [items, setItems] = useState<CartItem[]>([]);
  const [customerEmail, setCustomerEmail] = useState<string>("");

  const canUseImpression = productKind === "professions_de_foi" || productKind === "bulletins_de_vote";

  const newItem = useMemo<CartItem>(() => {
    if (productKind === "professions_de_foi") return { productKind, quantity, impression };
    if (productKind === "bulletins_de_vote") return { productKind, quantity, impression, bulletinFormat };
    return { productKind, quantity, afficheFormat };
  }, [productKind, quantity, impression, bulletinFormat, afficheFormat]);

  async function onCheckout() {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerEmail: customerEmail || undefined,
        items,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Checkout failed");
    window.location.href = data.url;
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
      <h2>Commande</h2>

      <label>
        Email (optionnel)
        <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
      </label>

      <label>
        Produit
        <select value={productKind} onChange={(e) => setProductKind(e.target.value as ProductKind)}>
          {productKinds.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Quantité
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value || "0", 10))}
        />
      </label>

      {canUseImpression && (
        <label>
          Impression
          <select value={impression} onChange={(e) => setImpression(e.target.value as ImpressionType)}>
            <option value="recto">Recto</option>
            <option value="recto_verso">Recto-verso</option>
          </select>
        </label>
      )}

      {productKind === "bulletins_de_vote" && (
        <label>
          Format liste
          <select value={bulletinFormat} onChange={(e) => setBulletinFormat(e.target.value as BulletinFormat)}>
            <option value="liste_5_31">5 à 31 noms</option>
            <option value="liste_32_plus">+31 noms</option>
          </select>
        </label>
      )}

      {productKind === "affiches" && (
        <label>
          Format affiche
          <select value={afficheFormat} onChange={(e) => setAfficheFormat(e.target.value as AfficheFormat)}>
            <option value="grand_format">Grand format (594×841)</option>
            <option value="petit_format">Petit format (297×420)</option>
          </select>
        </label>
      )}

      <button
        type="button"
        onClick={() => setItems((prev) => [...prev, newItem])}
      >
        Ajouter au panier
      </button>

      <div style={{ border: "1px solid #ddd", padding: 12 }}>
        <strong>Panier</strong>
        {items.length === 0 ? (
          <p>Aucun item</p>
        ) : (
          <ul>
            {items.map((it, idx) => (
              <li key={idx}>
                {it.productKind} — qty {it.quantity}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" disabled={items.length === 0} onClick={onCheckout}>
        Payer
      </button>
    </div>
  );
}
