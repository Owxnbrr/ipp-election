"use client";

import { useMemo, useState } from "react";
import type { CartItem, ProductKind, ImpressionType, BulletinFormat, AfficheFormat } from "@/types";
import { formatCents } from "@/lib/pricing";

type FormState =
  | {
      productKind: "professions_de_foi";
      impression: ImpressionType;
    }
  | {
      productKind: "bulletins_de_vote";
      impression: ImpressionType;
      bulletinFormat: BulletinFormat;
    }
  | {
      productKind: "affiches";
      afficheFormat: AfficheFormat;
    };

const productOptions: Array<{ value: ProductKind; label: string }> = [
  { value: "professions_de_foi", label: "Professions de foi" },
  { value: "bulletins_de_vote", label: "Bulletins de vote" },
  { value: "affiches", label: "Affiches" },
];

function labelItem(item: CartItem): string {
  if (item.productKind === "professions_de_foi") {
    return `Professions de foi • ${item.impression === "recto" ? "Recto" : "Recto-verso"}`;
  }
  if (item.productKind === "bulletins_de_vote") {
    const fmt = item.bulletinFormat === "liste_5_31" ? "Liste 5–31" : "Liste 32+";
    return `Bulletins de vote • ${fmt} • ${item.impression === "recto" ? "Recto" : "Recto-verso"}`;
  }
  return `Affiches • ${
    item.afficheFormat === "grand_format" ? "Grand format 594×841" : "Petit format 297×420"
  }`;
}

function buildCartItem(form: FormState, qty: number): CartItem {
  if (form.productKind === "professions_de_foi") {
    return { productKind: "professions_de_foi", quantity: qty, impression: form.impression };
  }
  if (form.productKind === "bulletins_de_vote") {
    return {
      productKind: "bulletins_de_vote",
      quantity: qty,
      impression: form.impression,
      bulletinFormat: form.bulletinFormat,
    };
  }
  return { productKind: "affiches", quantity: qty, afficheFormat: form.afficheFormat };
}

export default function OrderForm() {
  const [customerEmail, setCustomerEmail] = useState("");
  const [quantity, setQuantity] = useState<string>("");

  const [form, setForm] = useState<FormState>({
    productKind: "professions_de_foi",
    impression: "recto",
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  // UI helper totals (estimation TTC à 20% sur le panier — le backend fait foi)
  const totals = useMemo(() => {
    // Ici on ne recalcule pas le vrai prix (il vient serveur). On affiche juste un UX “panier”.
    // Tu peux brancher une route /api/pricing/quote plus tard si tu veux un total exact avant paiement.
    return {
      count: cart.length,
    };
  }, [cart]);

  const canAdd = useMemo(() => {
    if (quantity === "") return false;
    const n = Number(quantity);
    return Number.isFinite(n) && n > 0;
  }, [quantity]);

  async function onAddToCart() {
    setError(null);

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Veuillez entrer une quantité valide.");
      return;
    }

    const item = buildCartItem(form, qty);
    setCart((prev) => [...prev, item]);
    setQuantity(""); // ✅ reset sans 0
  }

  function removeItem(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  async function onPay() {
    setError(null);

    if (cart.length === 0) {
      setError("Votre panier est vide.");
      return;
    }

    setIsPaying(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: customerEmail.trim() ? customerEmail.trim() : undefined,
          items: cart,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Erreur lors de la création du paiement.");
        return;
      }

      if (!data?.url) {
        setError("URL de paiement manquante.");
        return;
      }

      window.location.href = data.url as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* LEFT: Form */}
      <div className="lg:col-span-7">
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-base font-semibold text-gray-900">Configuration</h3>
          <p className="mt-1 text-sm text-gray-600">Choisissez un produit, ses options et la quantité.</p>

          <div className="mt-6 space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Email (optionnel)</label>
              <input
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm
                           focus:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200"
                placeholder="email@exemple.fr"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            {/* Product */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Produit</label>
                <select
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm
                             focus:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200"
                  value={form.productKind}
                  onChange={(e) => {
                    const k = e.target.value as ProductKind;
                    if (k === "professions_de_foi") setForm({ productKind: k, impression: "recto" });
                    if (k === "bulletins_de_vote")
                      setForm({ productKind: k, impression: "recto", bulletinFormat: "liste_5_31" });
                    if (k === "affiches") setForm({ productKind: k, afficheFormat: "petit_format" });
                  }}
                >
                  {productOptions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantité</label>
                <input
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm
                             focus:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="ex: 100"
                  value={quantity}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d+$/.test(v)) setQuantity(v);
                  }}
                />
              </div>
            </div>

            {/* Conditional options */}
            {form.productKind !== "affiches" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Impression</label>
                  <select
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm
                               focus:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200"
                    value={form.impression}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...(prev as any),
                        impression: e.target.value as ImpressionType,
                      }))
                    }
                  >
                    <option value="recto">Recto</option>
                    <option value="recto_verso">Recto-verso</option>
                  </select>
                </div>

                {form.productKind === "bulletins_de_vote" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Format bulletin</label>
                    <select
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm
                                 focus:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200"
                      value={form.bulletinFormat}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...(prev as any),
                          bulletinFormat: e.target.value as BulletinFormat,
                        }))
                      }
                    >
                      <option value="liste_5_31">Liste 5–31 noms</option>
                      <option value="liste_32_plus">Liste +31 noms</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {form.productKind === "affiches" && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Format affiche</label>
                <select
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm
                             focus:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200"
                  value={form.afficheFormat}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...(prev as any),
                      afficheFormat: e.target.value as AfficheFormat,
                    }))
                  }
                >
                  <option value="petit_format">Petit format (297×420)</option>
                  <option value="grand_format">Grand format (594×841)</option>
                </select>
              </div>
            )}

            {/* CTA Add */}
            <button
              type="button"
              onClick={onAddToCart}
              disabled={!canAdd}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white
                         shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ajouter au panier
            </button>

            <p className="text-xs text-gray-500">
              Le prix final est calculé côté serveur selon les paliers tarifaires.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div className="lg:col-span-5">
        <div className="sticky top-6 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Panier</h3>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {totals.count} item{totals.count > 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {cart.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-600">
                  Aucun item pour le moment.
                </div>
              ) : (
                cart.map((it, idx) => (
                  <div key={idx} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{labelItem(it)}</p>
                        <p className="mt-1 text-sm text-gray-600">Quantité : {it.quantity}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={onPay}
              disabled={isPaying || cart.length === 0}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white
                         shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPaying ? "Redirection vers Stripe…" : "Payer"}
            </button>

            <p className="mt-3 text-xs text-gray-500">
              Vous serez redirigé vers Stripe pour finaliser le paiement.
            </p>
          </div>

          {/* Trust */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">Bon à savoir</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
              <li>Tarification par paliers (calcul serveur)</li>
              <li>Paiement par carte bancaire</li>
              <li>Commande enregistrée automatiquement</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
