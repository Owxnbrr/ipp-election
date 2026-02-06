# ElectionPrint - Plateforme de Commande d'Impression Électorale

Application Next.js complète pour la commande et le paiement de documents électoraux destinés aux mairies françaises.

## 🎯 Fonctionnalités

- **Commande multi-étapes** : Sélection de produits → Informations mairie → Récapitulatif et paiement
- **3 types de produits** :
  - Affiches électorales (formats A3, A2, A1)
  - Bulletins de vote (formats A6, A5)
  - Professions de foi (formats A4, A5)
- **Options personnalisables** : format, couleur, papier, finition/pliage
- **Calcul de prix côté serveur** (source de vérité : base de données)
- **Paiement sécurisé** via Stripe Checkout
- **Webhooks Stripe** pour confirmation de paiement
- **Pages légales** : CGV et Politique de confidentialité

## 🛠️ Stack Technique

- **Framework** : Next.js 14 (App Router)
- **Language** : TypeScript
- **Styling** : Tailwind CSS
- **Base de données** : Supabase (PostgreSQL)
- **Paiement** : Stripe (Checkout + Webhooks)
- **Validation** : Zod

## 📋 Prérequis

- Node.js 18+ et npm
- Compte Supabase (gratuit)
- Compte Stripe (mode test)
- Stripe CLI (pour tester les webhooks en local)

## 🚀 Installation

### 1. Cloner et installer les dépendances

```bash
cd election-print-shop
npm install
```

### 2. Configuration Supabase

#### A. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un nouveau projet
3. Notez l'URL et les clés API

#### B. Créer les tables

1. Dans le dashboard Supabase, allez dans SQL Editor
2. Copiez le contenu de `supabase-schema.sql`
3. Exécutez le script SQL
4. Vérifiez que les tables sont créées et les données de test insérées

### 3. Configuration Stripe

#### A. Créer un compte Stripe

1. Allez sur [stripe.com](https://stripe.com)
2. Créez un compte (utilisez le mode test)
3. Récupérez vos clés API dans Developers > API keys

#### B. Installer Stripe CLI (pour webhooks en local)

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop install stripe

# Linux
# Téléchargez depuis https://github.com/stripe/stripe-cli/releases
```

### 4. Variables d'environnement

Créez un fichier `.env.local` à la racine du projet :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

# App
BASE_URL=http://localhost:3000
```

**Important** : Le `STRIPE_WEBHOOK_SECRET` sera généré à l'étape suivante.

### 5. Lancer l'application

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

### 6. Configurer les webhooks Stripe (Local)

Dans un nouveau terminal :

```bash
# Se connecter à Stripe CLI
stripe login

# Écouter les webhooks et les rediriger vers votre serveur local
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Cette commande affichera votre `webhook signing secret` (commence par `whsec_`). 
Copiez-le dans votre `.env.local` :

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxx_que_vous_venez_de_recevoir
```

Redémarrez le serveur Next.js pour prendre en compte le nouveau secret.

## 🧪 Tester l'Application

### Test complet du parcours utilisateur

1. Allez sur [http://localhost:3000](http://localhost:3000)
2. Cliquez sur "Commencer ma commande"
3. **Étape 1** : Ajoutez des produits au panier
   - Choisissez un type de produit
   - Sélectionnez les options
   - Définissez une quantité
   - Ajoutez au panier
4. **Étape 2** : Remplissez les informations de la mairie
   - Nom, commune, email, téléphone
   - Adresses de facturation et livraison
5. **Étape 3** : Vérifiez le récapitulatif
   - Acceptez les CGV
   - Cliquez sur "Procéder au paiement"
6. Vous serez redirigé vers Stripe Checkout
7. Utilisez une carte de test :
   - Numéro : `4242 4242 4242 4242`
   - Date : n'importe quelle date future
   - CVC : n'importe quel 3 chiffres
8. Validez le paiement
9. Vous serez redirigé vers la page de confirmation

### Vérifier le webhook

Dans le terminal où `stripe listen` est actif, vous devriez voir :

```
✔ Received event checkout.session.completed
→ POST http://localhost:3000/api/stripe/webhook [200]
```

### Vérifier dans Supabase

Dans le dashboard Supabase, vérifiez :

1. **Table `orders`** : Une nouvelle commande avec `status = 'paid'`
2. **Table `order_items`** : Les lignes de la commande
3. **Table `stripe_events`** : L'événement webhook enregistré

## 📦 Structure du Projet

```
election-print-shop/
├── app/
│   ├── api/
│   │   └── stripe/
│   │       ├── checkout/
│   │       │   └── route.ts          # Création session Stripe
│   │       └── webhook/
│   │           └── route.ts          # Traitement webhooks
│   ├── commande/
│   │   └── page.tsx                  # Page de commande
│   ├── merci/
│   │   └── page.tsx                  # Page de confirmation
│   ├── cgv/
│   │   └── page.tsx                  # CGV
│   ├── confidentialite/
│   │   └── page.tsx                  # Politique de confidentialité
│   ├── layout.tsx                    # Layout principal
│   ├── page.tsx                      # Page d'accueil
│   └── globals.css                   # Styles globaux
├── components/
│   └── OrderForm.tsx                 # Formulaire de commande multi-étapes
├── lib/
│   ├── supabase.ts                   # Client Supabase
│   ├── stripe.ts                     # Client Stripe
│   └── pricing.ts                    # Calcul de prix
├── types/
│   └── index.ts                      # Types TypeScript
├── supabase-schema.sql               # Schéma base de données
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 🔐 Sécurité

### Calcul des prix

**IMPORTANT** : Les prix sont toujours calculés côté serveur depuis la base de données. 
Le client ne peut jamais influencer les prix.

```typescript
// ❌ MAUVAIS - Ne jamais faire confiance au client
const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

// ✅ BON - Toujours recalculer côté serveur
const priceCalculation = await calculateOrderTotal(items);
```

### Idempotence des webhooks

Les webhooks Stripe sont enregistrés dans la table `stripe_events` pour éviter 
le double traitement en cas de renvoi.

### Variables d'environnement

- Les clés `SUPABASE_SERVICE_ROLE_KEY` et `STRIPE_SECRET_KEY` ne doivent **JAMAIS** 
  être exposées côté client
- Utilisez uniquement `NEXT_PUBLIC_*` pour les variables accessibles au client

## 🚀 Déploiement en Production

### 1. Déployer sur Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel
```

### 2. Configurer les variables d'environnement

Dans le dashboard Vercel, ajoutez toutes les variables d'environnement.

**Important** : Mettez à jour `BASE_URL` avec votre URL de production.

### 3. Configurer le webhook Stripe en production

1. Dans le dashboard Stripe, allez dans Developers > Webhooks
2. Cliquez sur "Add endpoint"
3. URL : `https://votre-domaine.com/api/stripe/webhook`
4. Événements à écouter : `checkout.session.completed`, `payment_intent.succeeded`
5. Copiez le `Signing secret` et mettez-le dans `STRIPE_WEBHOOK_SECRET` sur Vercel

### 4. Passer en mode Live

Une fois les tests terminés :

1. Remplacez les clés Stripe test (`sk_test_`, `pk_test_`) par les clés live
2. Vérifiez que le webhook est bien configuré en mode live
3. Testez une vraie transaction

## 🎨 Personnalisation

### Modifier les couleurs

Éditez `tailwind.config.ts` :

```typescript
theme: {
  extend: {
    colors: {
      primary: {
        // Vos couleurs ici
      },
    },
  },
},
```

### Ajouter des options de produits

1. Ajoutez les options dans Supabase (table `product_options`)
2. Ajoutez les règles de prix correspondantes (table `pricing_rules`)
3. Le formulaire s'adaptera automatiquement

### Modifier les prix

Les prix sont dans la table `pricing_rules`. Modifiez directement dans Supabase 
ou créez une interface admin.

## 📧 Email de Confirmation (Bonus)

Pour envoyer des emails de confirmation, intégrez un service comme Resend :

```bash
npm install resend
```

Dans `app/api/stripe/webhook/route.ts`, ajoutez :

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Après avoir marqué la commande comme 'paid'
await resend.emails.send({
  from: 'ElectionPrint <noreply@electionprint.fr>',
  to: order.customer_email,
  subject: 'Confirmation de votre commande',
  html: `<p>Votre commande ${order.id} a été confirmée...</p>`,
});
```

## 🐛 Dépannage

### Les webhooks ne fonctionnent pas

- Vérifiez que `stripe listen` est actif
- Vérifiez que le `STRIPE_WEBHOOK_SECRET` est correct
- Regardez les logs dans le terminal Stripe CLI

### Erreur de connexion à Supabase

- Vérifiez les variables d'environnement
- Vérifiez que les tables existent
- Vérifiez les politiques RLS (Row Level Security)

### Erreur de calcul de prix

- Vérifiez que les règles de prix existent pour toutes les combinaisons
- Regardez les logs dans la console

## 📝 Licence

Ce projet est fourni à titre d'exemple. Adaptez-le selon vos besoins.

## 🤝 Support

Pour toute question, ouvrez une issue sur GitHub ou contactez-nous.

---

**Développé avec ❤️ pour simplifier les commandes électorales des mairies françaises**
