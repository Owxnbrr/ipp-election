'use client';

import { useState, useEffect } from 'react';
import { CartItem, MairieInfo, ProductType, ProductConfig } from '@/types';
import { formatCents } from '@/lib/pricing';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';

interface OrderFormProps {
  productsConfig: ProductConfig;
}

export default function OrderForm({ productsConfig }: OrderFormProps) {
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mairieInfo, setMairieInfo] = useState<MairieInfo>({
    mairie_name: '',
    commune: '',
    email: '',
    phone: '',
    billing_address: { street: '', postal_code: '', city: '', country: 'France' },
    shipping_address: { street: '', postal_code: '', city: '', country: 'France' },
    same_as_billing: true,
  });
  const [acceptCgv, setAcceptCgv] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nouveau produit temporaire
  const [newItem, setNewItem] = useState<Partial<CartItem>>({
    product_type: 'affiches',
    quantity: 100,
  });

  const handleAddToCart = () => {
    if (!newItem.product_type || !newItem.quantity || newItem.quantity < 1) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    const product = productsConfig.products.find(p => p.type === newItem.product_type);
    if (!product) return;

    // Vérifier que toutes les options sont remplies
    const options = productsConfig.options[newItem.product_type as ProductType];
    const selectedOptions: any = {};
    
    for (const key in options) {
      const value = (newItem as any)[key];
      if (!value) {
        alert(`Veuillez sélectionner ${key}`);
        return;
      }
      selectedOptions[key] = value;
    }

    const cartItem: CartItem = {
      product_type: newItem.product_type as ProductType,
      product_name: product.name,
      options: selectedOptions,
      quantity: newItem.quantity,
    };

    setCart([...cart, cartItem]);
    
    // Reset form
    setNewItem({
      product_type: 'affiches',
      quantity: 100,
    });
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      alert('Votre panier est vide');
      return;
    }

    if (!acceptCgv) {
      alert('Vous devez accepter les CGV');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          mairie_info: mairieInfo,
          accept_cgv: acceptCgv,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de la session');
      }

      // Rediriger vers Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              s === step
                ? 'bg-primary-600 text-white'
                : s < step
                ? 'bg-primary-200 text-primary-700'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {s}
          </div>
          {s < 3 && (
            <div
              className={`w-20 h-1 ${
                s < step ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-6">Étape 1: Choisissez vos produits</h2>

      {/* Formulaire d'ajout */}
      <div className="card mb-6">
        <h3 className="font-bold mb-4">Ajouter un produit</h3>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Type de produit</label>
            <select
              className="input"
              value={newItem.product_type}
              onChange={(e) => setNewItem({ ...newItem, product_type: e.target.value as ProductType })}
            >
              {productsConfig.products.map((product) => (
                <option key={product.type} value={product.type}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Quantité</label>
            <input
              type="number"
              className="input"
              min="1"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
            />
          </div>
        </div>

        {/* Options dynamiques selon le produit */}
        {newItem.product_type && (
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {Object.entries(productsConfig.options[newItem.product_type as ProductType]).map(([key, values]) => (
              <div key={key}>
                <label className="label capitalize">{key}</label>
                <select
                  className="input"
                  value={(newItem as any)[key] || ''}
                  onChange={(e) => setNewItem({ ...newItem, [key]: e.target.value })}
                >
                  <option value="">Sélectionner</option>
                  {values.map((value: string) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <button onClick={handleAddToCart} className="btn-primary">
          <ShoppingCart className="w-4 h-4 inline mr-2" />
          Ajouter au panier
        </button>
      </div>

      {/* Panier */}
      {cart.length > 0 && (
        <div className="card">
          <h3 className="font-bold mb-4">Votre panier ({cart.length} article{cart.length > 1 ? 's' : ''})</h3>
          <div className="space-y-3">
            {cart.map((item, index) => (
              <div key={index} className="flex justify-between items-start border-b pb-3">
                <div className="flex-1">
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-gray-600">
                    {Object.entries(item.options).map(([key, value]) => (
                      <span key={key} className="mr-2">
                        {key}: {value}
                      </span>
                    ))}
                  </p>
                  <p className="text-sm text-gray-600">Quantité: {item.quantity}</p>
                </div>
                <button
                  onClick={() => handleRemoveFromCart(index)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <button
          onClick={() => setStep(2)}
          disabled={cart.length === 0}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuer
          <ChevronRight className="w-4 h-4 inline ml-2" />
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-6">Étape 2: Informations de livraison</h2>

      <div className="card mb-6">
        <h3 className="font-bold mb-4">Informations mairie</h3>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Nom de la mairie *</label>
            <input
              type="text"
              className="input"
              value={mairieInfo.mairie_name}
              onChange={(e) => setMairieInfo({ ...mairieInfo, mairie_name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Commune *</label>
            <input
              type="text"
              className="input"
              value={mairieInfo.commune}
              onChange={(e) => setMairieInfo({ ...mairieInfo, commune: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              className="input"
              value={mairieInfo.email}
              onChange={(e) => setMairieInfo({ ...mairieInfo, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Téléphone *</label>
            <input
              type="tel"
              className="input"
              value={mairieInfo.phone}
              onChange={(e) => setMairieInfo({ ...mairieInfo, phone: e.target.value })}
              required
            />
          </div>
        </div>

        <h4 className="font-bold mb-4 mt-6">Adresse de facturation</h4>
        <div className="space-y-4 mb-4">
          <div>
            <label className="label">Adresse *</label>
            <input
              type="text"
              className="input"
              value={mairieInfo.billing_address.street}
              onChange={(e) =>
                setMairieInfo({
                  ...mairieInfo,
                  billing_address: { ...mairieInfo.billing_address, street: e.target.value },
                })
              }
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Code postal *</label>
              <input
                type="text"
                className="input"
                value={mairieInfo.billing_address.postal_code}
                onChange={(e) =>
                  setMairieInfo({
                    ...mairieInfo,
                    billing_address: { ...mairieInfo.billing_address, postal_code: e.target.value },
                  })
                }
                required
              />
            </div>

            <div>
              <label className="label">Ville *</label>
              <input
                type="text"
                className="input"
                value={mairieInfo.billing_address.city}
                onChange={(e) =>
                  setMairieInfo({
                    ...mairieInfo,
                    billing_address: { ...mairieInfo.billing_address, city: e.target.value },
                  })
                }
                required
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={mairieInfo.same_as_billing}
              onChange={(e) =>
                setMairieInfo({
                  ...mairieInfo,
                  same_as_billing: e.target.checked,
                  shipping_address: e.target.checked
                    ? mairieInfo.billing_address
                    : mairieInfo.shipping_address,
                })
              }
              className="mr-2"
            />
            <span className="text-sm">Adresse de livraison identique</span>
          </label>
        </div>

        {!mairieInfo.same_as_billing && (
          <>
            <h4 className="font-bold mb-4 mt-6">Adresse de livraison</h4>
            <div className="space-y-4">
              <div>
                <label className="label">Adresse *</label>
                <input
                  type="text"
                  className="input"
                  value={mairieInfo.shipping_address.street}
                  onChange={(e) =>
                    setMairieInfo({
                      ...mairieInfo,
                      shipping_address: { ...mairieInfo.shipping_address, street: e.target.value },
                    })
                  }
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Code postal *</label>
                  <input
                    type="text"
                    className="input"
                    value={mairieInfo.shipping_address.postal_code}
                    onChange={(e) =>
                      setMairieInfo({
                        ...mairieInfo,
                        shipping_address: { ...mairieInfo.shipping_address, postal_code: e.target.value },
                      })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="label">Ville *</label>
                  <input
                    type="text"
                    className="input"
                    value={mairieInfo.shipping_address.city}
                    onChange={(e) =>
                      setMairieInfo({
                        ...mairieInfo,
                        shipping_address: { ...mairieInfo.shipping_address, city: e.target.value },
                      })
                    }
                    required
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={() => setStep(1)} className="btn-secondary">
          <ChevronLeft className="w-4 h-4 inline mr-2" />
          Retour
        </button>
        <button
          onClick={() => setStep(3)}
          disabled={
            !mairieInfo.mairie_name ||
            !mairieInfo.commune ||
            !mairieInfo.email ||
            !mairieInfo.phone ||
            !mairieInfo.billing_address.street ||
            !mairieInfo.billing_address.postal_code ||
            !mairieInfo.billing_address.city
          }
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuer
          <ChevronRight className="w-4 h-4 inline ml-2" />
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-6">Étape 3: Récapitulatif et paiement</h2>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Récapitulatif commande */}
        <div className="card">
          <h3 className="font-bold mb-4">Votre commande</h3>
          <div className="space-y-3 mb-4">
            {cart.map((item, index) => (
              <div key={index} className="border-b pb-3">
                <p className="font-medium">{item.product_name}</p>
                <p className="text-sm text-gray-600">
                  {Object.entries(item.options).map(([key, value]) => (
                    <span key={key} className="mr-2">
                      {key}: {value}
                    </span>
                  ))}
                </p>
                <p className="text-sm text-gray-600">Quantité: {item.quantity}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600">
            Les prix seront calculés et affichés avant le paiement.
          </p>
        </div>

        {/* Informations mairie */}
        <div className="card">
          <h3 className="font-bold mb-4">Informations de livraison</h3>
          <div className="space-y-2 text-sm">
            <p><strong>Mairie:</strong> {mairieInfo.mairie_name}</p>
            <p><strong>Commune:</strong> {mairieInfo.commune}</p>
            <p><strong>Email:</strong> {mairieInfo.email}</p>
            <p><strong>Téléphone:</strong> {mairieInfo.phone}</p>
            <p className="pt-2"><strong>Facturation:</strong></p>
            <p>{mairieInfo.billing_address.street}</p>
            <p>{mairieInfo.billing_address.postal_code} {mairieInfo.billing_address.city}</p>
            {!mairieInfo.same_as_billing && (
              <>
                <p className="pt-2"><strong>Livraison:</strong></p>
                <p>{mairieInfo.shipping_address.street}</p>
                <p>{mairieInfo.shipping_address.postal_code} {mairieInfo.shipping_address.city}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CGV */}
      <div className="card mt-6">
        <label className="flex items-start">
          <input
            type="checkbox"
            checked={acceptCgv}
            onChange={(e) => setAcceptCgv(e.target.checked)}
            className="mt-1 mr-3"
          />
          <span className="text-sm">
            J&apos;accepte les{' '}
            <a href="/cgv" target="_blank" className="text-primary-600 underline">
              conditions générales de vente
            </a>{' '}
            et la{' '}
            <a href="/confidentialite" target="_blank" className="text-primary-600 underline">
              politique de confidentialité
            </a>
          </span>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mt-4">
          {error}
        </div>
      )}

      <div className="flex justify-between mt-8">
        <button onClick={() => setStep(2)} className="btn-secondary" disabled={loading}>
          <ChevronLeft className="w-4 h-4 inline mr-2" />
          Retour
        </button>
        <button
          onClick={handleSubmit}
          disabled={!acceptCgv || loading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Chargement...' : 'Procéder au paiement'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {renderStepIndicator()}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
}
