# 🚀 Démarrage Rapide - ElectionPrint

Ce guide vous permet de démarrer l'application en 10 minutes.

## ✅ Checklist de Configuration

### 1. Installation (2 min)

```bash
cd election-print-shop
npm install
```

### 2. Configuration Supabase (3 min)

1. Créez un compte sur [supabase.com](https://supabase.com)
2. Créez un nouveau projet
3. Dans SQL Editor, collez et exécutez le contenu de `supabase-schema.sql`
4. Allez dans Settings > API et copiez :
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Configuration Stripe (2 min)

1. Créez un compte sur [stripe.com](https://stripe.com) (mode test)
2. Allez dans Developers > API keys
3. Copiez :
   - Secret key (sk_test_...) → `STRIPE_SECRET_KEY`
   - Publishable key (pk_test_...) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### 4. Fichier .env.local (1 min)

Créez `.env.local` à la racine :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

# App
BASE_URL=http://localhost:3000
```

**Note** : Le `STRIPE_WEBHOOK_SECRET` sera généré à l'étape 6.

### 5. Lancer l'Application (30 sec)

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000)

### 6. Configuration Webhook Stripe (2 min)

**Terminal 2** (gardez npm run dev actif dans le terminal 1) :

```bash
# Installer Stripe CLI (si pas déjà fait)
# macOS : brew install stripe/stripe-cli/stripe
# Windows : scoop install stripe

# Se connecter
stripe login

# Lancer le listener
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copiez le `whsec_...` affiché et mettez-le dans `.env.local` comme `STRIPE_WEBHOOK_SECRET`.

**Redémarrez npm run dev** (Ctrl+C puis relancez).

## 🎉 C'est Prêt !

### Test Rapide

1. Allez sur [http://localhost:3000](http://localhost:3000)
2. Cliquez sur "Commencer ma commande"
3. Ajoutez un produit au panier
4. Remplissez les infos (utilisez des données fictives)
5. Validez et payez avec la carte test : `4242 4242 4242 4242`
6. Vérifiez la page de confirmation

### Vérifications

- ✅ Terminal Stripe CLI : `✔ Received event checkout.session.completed`
- ✅ Supabase > Table orders : 1 commande avec `status = 'paid'`
- ✅ Page merci affiche les détails de la commande

## 🐛 Problèmes Fréquents

### "Missing Supabase environment variables"

→ Vérifiez que `.env.local` existe et contient les bonnes clés.

### "Failed to fetch products"

→ Vérifiez que le script SQL a bien été exécuté dans Supabase.

### Webhook non reçu

→ Vérifiez que `stripe listen` est actif et que `STRIPE_WEBHOOK_SECRET` est correct.

### Page blanche

→ Regardez les erreurs dans la console du navigateur (F12).

## 📚 Prochaines Étapes

1. Lisez le [README.md](README.md) complet pour plus de détails
2. Consultez [WEBHOOK_TESTING.md](WEBHOOK_TESTING.md) pour les tests avancés
3. Personnalisez les couleurs dans `tailwind.config.ts`
4. Ajustez les prix dans Supabase (`pricing_rules` table)
5. Déployez sur Vercel quand vous êtes prêt

## 💡 Astuces

- Utilisez les **devtools** du navigateur pour déboguer
- Consultez les **logs Supabase** (Dashboard > Logs)
- Utilisez **Stripe Dashboard > Events** pour voir tous les webhooks
- Les prix de test sont dans la table `pricing_rules` (modifiables)

## 🆘 Besoin d'Aide ?

- Documentation Next.js : [nextjs.org/docs](https://nextjs.org/docs)
- Documentation Supabase : [supabase.com/docs](https://supabase.com/docs)
- Documentation Stripe : [stripe.com/docs](https://stripe.com/docs)
- Guide des webhooks : [WEBHOOK_TESTING.md](WEBHOOK_TESTING.md)

---

**Bon développement ! 🚀**
