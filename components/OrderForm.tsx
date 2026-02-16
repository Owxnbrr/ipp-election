"use client";

import { useMemo, useState } from "react";
import type {
  CartItem,
  ProductKind,
  ImpressionType,
  BulletinFormat,
  AfficheFormat,
} from "@/types";

import { getProductsConfig } from "@/lib/pricing";

function itemLabel(item: CartItem): string {
  if (item.productKind === "professions_de_foi") {
    return `Professions de foi — ${item.impression === "recto" ? "Recto" : "Recto-verso"}`;
  }
  if (item.productKind === "bulletins_de_vote") {
    const fmt = item.bulletinFormat === "liste_5_31" ? "Liste 5–31" : "Liste 32+";
    return `Bulletins de vote — ${fmt} — ${item.impression === "recto" ? "Recto" : "Recto-verso"}`;
  }
  const af = item.afficheFormat === "grand_format" ? "Grand format 594×841" : "Petit format 297×420";
  return `Affiches — ${af}`;
}

export default function OrderForm() {
  const productsConfig = getProductsConfig();

  const [customerEmail, setCustomerEmail] = useState("");
  const [productKind, setProductKind] = useState<ProductKind>("professions_de_foi");
  const [quantity, setQuantity] = useState<number>(100);

  const [impression, setImpression] = useState<ImpressionType>("recto_verso");
  const [bulletinFormat, setBulletinFormat] = useState<BulletinFormat>("liste_5_31");
  const [afficheFormat, setAfficheFormat] = useState<AfficheFormat>("grand_format");

  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newItem = useMemo<CartItem>(() => {
    if (productKind === "professions_de_foi") {
      return { productKind, quantity, impression };
    }
    if (productKind === "bulletins_de_vote") {
      return { productKind, quantity, impression, bulletinFormat };
    }
    return { productKind, quantity, afficheFormat };
  }, [productKind, quantity, impression, bulletinFormat, afficheFormat]);

  function addToCart() {
    setError(null);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantité invalide.");
      return;
    }

    setItems((prev) => [...prev, newItem]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function checkout() {
    setError(null);

    if (items.length === 0) {
      setError("Le panier est vide.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerEmail: customerEmail || undefined,
        items,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error ?? `HTTP ${res.status}`);
    }

    window.location.href = data.url;

    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const showImpression = productKind === "professions_de_foi" || productKind === "bulletins_de_vote";

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
      <h2>Commande</h2>

      {error && (
        <div style={{ padding: 10, border: "1px solid #f00", color: "#900" }}>
          {error}
        </div>
      )}

      <label>
        Email
        <input
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="email@exemple.fr"
          style={{ width: "100%" }}
        />
      </label>

      <label>
        Produit
        <select
          value={productKind}
          onChange={(e) => setProductKind(e.target.value as ProductKind)}
          style={{ width: "100%" }}
        >
          {productsConfig
            .filter((p) => p.isActive)
            .map((p) => (
              <option key={p.kind} value={p.kind}>
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
          style={{ width: "100%" }}
        />
      </label>

      {showImpression && (
        <label>
          Impression
          <select
            value={impression}
            onChange={(e) => setImpression(e.target.value as ImpressionType)}
            style={{ width: "100%" }}
          >
            <option value="recto">Recto</option>
            <option value="recto_verso">Recto-verso</option>
          </select>
        </label>
      )}

      {productKind === "bulletins_de_vote" && (
        <label>
          Format (liste)
          <select
            value={bulletinFormat}
            onChange={(e) => setBulletinFormat(e.target.value as BulletinFormat)}
            style={{ width: "100%" }}
          >
            <option value="liste_5_31">5 à 31 noms</option>
            <option value="liste_32_plus">+31 noms</option>
          </select>
        </label>
      )}

      {productKind === "affiches" && (
        <label>
          Format affiche
          <select
            value={afficheFormat}
            onChange={(e) => setAfficheFormat(e.target.value as AfficheFormat)}
            style={{ width: "100%" }}
          >
            <option value="grand_format">Grand format (594×841)</option>
            <option value="petit_format">Petit format (297×420)</option>
          </select>
        </label>
      )}

      <button type="button" onClick={addToCart}>
        Ajouter au panier
      </button>

      <div style={{ border: "1px solid #ddd", padding: 12 }}>
        <strong>Panier</strong>

        {items.length === 0 ? (
          <p>Aucun item</p>
        ) : (
          <ul style={{ marginTop: 8 }}>
            {items.map((it, idx) => (
              <li key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>
                  {itemLabel(it)} — qty {it.quantity}
                </span>
                <button type="button" onClick={() => removeItem(idx)}>
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" disabled={loading || items.length === 0} onClick={checkout}>
        {loading ? "Paiement..." : "Payer"}
      </button>
    </div>
  );
}
