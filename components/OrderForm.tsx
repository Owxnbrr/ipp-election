"use client";

import { useEffect, useMemo, useState } from "react";
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
  return `Affiches • ${item.afficheFormat === "grand_format" ? "Grand format 594×841" : "Petit format 297×420"}`;
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

type Quote = any;

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

  // ✅ fichiers
  const [files, setFiles] = useState<File[]>([]);

  // ✅ Quote serveur
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const totals = useMemo(() => {
    return { count: cart.length };
  }, [cart.length]);

  const canAdd = useMemo(() => {
    if (quantity === "") return false;
    const n = Number(quantity);
    return Number.isFinite(n) && n > 0;
  }, [quantity]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setQuoteError(null);

      if (!cart.length) {
        setQuote(null);
        return;
      }

      setQuoteLoading(true);
      try {
        const res = await fetch("/api/pricing/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: cart }),
        });

        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setQuote(null);
          setQuoteError(data?.error ?? "Impossible de calculer le prix.");
          return;
        }

        setQuote(data);
      } catch (e) {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(e instanceof Error ? e.message : "Erreur réseau (quote).");
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [cart]);

  async function onAddToCart() {
    setError(null);

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Veuillez entrer une quantité valide.");
      return;
    }

    const item = buildCartItem(form, qty);
    setCart((prev) => [...prev, item]);
    setQuantity("");
  }

  function removeItem(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function onFilesPicked(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);

    // filtre simple (tu peux élargir)
    const allowed = picked.filter((f) => {
      const t = (f.type || "").toLowerCase();
      return (
        t.includes("pdf") ||
        t.startsWith("image/") ||
        t.includes("zip") ||
        t.includes("octet-stream") // certains navigateurs
      );
    });

    setFiles((prev) => [...prev, ...allowed]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onPay() {
    setError(null);

    if (cart.length === 0) {
      setError("Votre panier est vide.");
      return;
    }

    // 🔒 Recommandé : exiger au moins 1 fichier
    if (files.length === 0) {
      setError("Ajoutez au moins un fichier (PDF / image) avant de payer.");
      return;
    }

    if (quoteLoading || quoteError) {
      setError("Le prix n'est pas disponible. Vérifiez le calcul du panier.");
      return;
    }

    setIsPaying(true);
    try {
      // 1) Crée une commande draft (pending) -> orderId
      const draftRes = await fetch("/api/orders/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: customerEmail.trim() ? customerEmail.trim() : undefined,
          items: cart,
        }),
      });

      const draftData = await draftRes.json();
      if (!draftRes.ok) {
        setError(draftData?.error ?? "Erreur lors de la création de la commande.");
        return;
      }

      const orderId = draftData?.orderId as string | undefined;
      if (!orderId) {
        setError("orderId manquant.");
        return;
      }

      // 2) Upload fichiers -> /api/orders/{orderId}/files
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));

      const upRes = await fetch(`/api/orders/${orderId}/files`, {
        method: "POST",
        body: fd,
      });

      const upData = await upRes.json();
      if (!upRes.ok) {
        setError(upData?.error ?? "Erreur upload fichiers.");
        return;
      }

      // 3) Lancer Stripe Checkout avec l'orderId existant
      const payRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const payData = await payRes.json();
      if (!payRes.ok) {
        setError(payData?.error ?? "Erreur lors de la création du paiement.");
        return;
      }

      if (!payData?.url) {
        setError("URL de paiement manquante.");
        return;
      }

      window.location.href = payData.url as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setIsPaying(false);
    }
  }

  const quoteItems: any[] = quote?.items ?? [];
  const quoteSubtotalHt = quote?.subtotalHtCents ?? null;
  const quoteVat = quote?.vatCents ?? null;
  const quoteTotalTtc = quote?.totalTtcCents ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
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
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm
                           focus:border-gray-400 focus:outline-none focus:ring-4 focus:ring-gray-200"
                placeholder="email@exemple.fr"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            {/* ✅ Upload */}
            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Vos fichiers (PDF / images)</p>
                  <p className="text-xs text-gray-500">Ils seront associés à la commande et accessibles 30 jours.</p>
                </div>

                <label className="inline-flex cursor-pointer items-center rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800">
                  Ajouter
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept="application/pdf,image/*,.zip"
                    onChange={(e) => {
                      onFilesPicked(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              {files.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-gray-200 p-3 text-sm text-gray-600">
                  Aucun fichier ajouté.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {files.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{f.name}</p>
                        <p className="text-xs text-gray-500">{Math.round(f.size / 1024)} Ko</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Product + Qty */}
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
                    value={(form as any).impression}
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
                      value={(form as any).bulletinFormat}
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
                  value={(form as any).afficheFormat}
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

            <button
              type="button"
              onClick={onAddToCart}
              disabled={!canAdd}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white
                         shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ajouter au panier
            </button>
          </div>
        </div>
      </div>

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
                cart.map((it, idx) => {
                  const qi = quoteItems?.[idx];
                  const ht = qi?.totalHtCents ?? null;
                  const vat = qi?.vatCents ?? null;
                  const ttc = qi?.totalTtcCents ?? (ht != null && vat != null ? ht + vat : null);
                  const vatRate = qi?.vatRate ?? null;

                  return (
                    <div key={idx} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="truncate text-sm font-semibold text-gray-900">{labelItem(it)}</p>
                            <div className="shrink-0 text-right">
                              <div className="text-xs text-gray-500">TTC</div>
                              <div className="text-sm font-semibold text-gray-900">
                                {quoteLoading ? "…" : ttc != null ? formatCents(ttc) : "—"}
                              </div>
                            </div>
                          </div>

                          <p className="mt-1 text-sm text-gray-600">Quantité : {it.quantity}</p>

                          {!quoteLoading && !quoteError && quote && ht != null && vat != null && (
                            <p className="mt-2 text-xs text-gray-500">
                              {formatCents(ht)} HT + {formatCents(vat)} TVA
                              {vatRate != null ? ` (${(vatRate * 100).toFixed(1).replace(".", ",")}%)` : ""}
                            </p>
                          )}

                          {!quoteLoading && quoteError && <p className="mt-2 text-xs text-red-600">{quoteError}</p>}
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
                  );
                })
              )}
            </div>

            {cart.length > 0 && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                {quoteLoading ? (
                  <div className="text-gray-500">Calcul du total…</div>
                ) : quoteError ? (
                  <div className="text-red-600">{quoteError}</div>
                ) : quote ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Sous-total HT</span>
                      <span className="font-medium text-gray-900">
                        {quoteSubtotalHt != null ? formatCents(quoteSubtotalHt) : "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">TVA</span>
                      <span className="font-medium text-gray-900">{quoteVat != null ? formatCents(quoteVat) : "—"}</span>
                    </div>

                    <div className="h-px w-full bg-gray-200" />

                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Total TTC</span>
                      <span className="font-semibold text-gray-900">
                        {quoteTotalTtc != null ? formatCents(quoteTotalTtc) : "—"}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <button
              type="button"
              onClick={onPay}
              disabled={isPaying || cart.length === 0 || !!quoteError || quoteLoading}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white
                        shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPaying ? "Préparation…" : "Payer"}
            </button>

            <p className="mt-3 text-xs text-gray-500">Vous serez redirigé vers Stripe pour finaliser le paiement.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
