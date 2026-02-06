# Guide de Test des Webhooks Stripe

Ce guide vous aide à tester les webhooks Stripe en développement local.

## Méthode 1 : Stripe CLI (Recommandée)

### Installation

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (avec Scoop)
scoop install stripe

# Linux
# Téléchargez depuis https://github.com/stripe/stripe-cli/releases
```

### Configuration

1. **Connectez-vous à Stripe**

```bash
stripe login
```

Cela ouvrira votre navigateur pour autoriser l'accès.

2. **Lancez le listener**

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

3. **Copiez le webhook secret**

Quand vous lancez `stripe listen`, vous verrez un message comme :

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

Copiez ce secret dans votre `.env.local` :

```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

4. **Redémarrez Next.js**

```bash
# Arrêtez le serveur (Ctrl+C) puis relancez
npm run dev
```

### Test

1. Dans votre application, passez une commande
2. Utilisez la carte de test : `4242 4242 4242 4242`
3. Dans le terminal où `stripe listen` tourne, vous verrez :

```
2024-01-15 10:30:45  --> checkout.session.completed [evt_xxx]
2024-01-15 10:30:45  <-- [200] POST http://localhost:3000/api/stripe/webhook [evt_xxx]
```

4. Vérifiez dans Supabase que la commande est passée à `status = 'paid'`

## Méthode 2 : Déclencher manuellement un événement

Pour tester sans faire de vraie commande :

```bash
stripe trigger checkout.session.completed
```

**Note** : Cette méthode ne créera pas de commande dans votre base, car il n'y aura 
pas de metadata.order_id. C'est utile pour tester que le webhook est bien reçu.

## Vérifications

### 1. Le webhook est bien reçu

Dans les logs de votre terminal Next.js, vous devriez voir :

```
Checkout session completed: cs_test_xxxxx
Order marked as paid: uuid-de-la-commande
```

### 2. Vérifier dans Supabase

Ouvrez le dashboard Supabase et vérifiez :

**Table orders**
```sql
SELECT id, status, stripe_session_id, total_ttc_cents 
FROM orders 
ORDER BY created_at DESC 
LIMIT 1;
```

Le status doit être `paid`.

**Table stripe_events**
```sql
SELECT event_id, type, processed 
FROM stripe_events 
ORDER BY created_at DESC 
LIMIT 5;
```

Vous devriez voir l'événement `checkout.session.completed` avec `processed = true`.

### 3. Vérifier dans Stripe Dashboard

Allez dans Stripe Dashboard > Developers > Events

Vous verrez tous les événements envoyés, avec leur statut de livraison.

## Problèmes Courants

### Erreur : "No signatures found matching the expected signature"

**Cause** : Le `STRIPE_WEBHOOK_SECRET` est incorrect ou manquant.

**Solution** :
1. Vérifiez que vous avez copié le secret depuis `stripe listen`
2. Redémarrez le serveur Next.js après l'avoir ajouté

### Erreur : "connect ECONNREFUSED 127.0.0.1:3000"

**Cause** : Next.js n'est pas lancé ou tourne sur un autre port.

**Solution** :
1. Vérifiez que `npm run dev` est actif
2. Si Next.js tourne sur un autre port, adaptez la commande :
   ```bash
   stripe listen --forward-to localhost:VOTRE_PORT/api/stripe/webhook
   ```

### Le webhook est reçu mais la commande n'est pas mise à jour

**Cause** : Probablement un problème avec `metadata.order_id`.

**Solution** :
1. Vérifiez les logs : `console.log('Order ID from metadata:', session.metadata?.order_id)`
2. Vérifiez que l'order_id existe bien dans la table orders
3. Vérifiez les permissions Supabase (RLS)

### L'événement est traité plusieurs fois

**Cause** : Le système d'idempotence ne fonctionne pas.

**Solution** :
1. Vérifiez que la table `stripe_events` existe
2. Vérifiez que le champ `event_id` est unique
3. Vérifiez les logs pour voir si l'événement est bien marqué comme `processed`

## En Production

En production, vous n'utiliserez pas `stripe listen`. À la place :

1. **Créez un endpoint webhook dans Stripe Dashboard**
   - URL : `https://votre-domaine.com/api/stripe/webhook`
   - Événements : `checkout.session.completed`, `payment_intent.succeeded`

2. **Copiez le signing secret**
   - Il commence par `whsec_`
   - Ajoutez-le dans vos variables d'environnement Vercel

3. **Testez en mode test**
   - Faites une vraie commande sur votre site de production (avec une carte test)
   - Vérifiez dans Stripe Dashboard > Webhooks que l'événement a été délivré

4. **Passez en mode live**
   - Créez un nouveau webhook endpoint en mode live
   - Remplacez le signing secret
   - Testez avec une vraie carte (montant minimum)

## Tips

- Gardez toujours un terminal avec `stripe listen` ouvert pendant le développement
- Utilisez `stripe logs tail` pour voir tous les événements en temps réel
- Testez différents scénarios : paiement réussi, échoué, annulé
- Consultez les logs Stripe Dashboard pour déboguer en production

## Ressources

- [Documentation Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
