// lib/pricing.ts
import type {
  CartItem,
  MoneyCents,
  PricedItem,
  PricedOrder,
  PricingBlockRow,
  PricingBreakdownRow,
  ProductKind,
} from "@/types";

type RoundingMode = "none" | "ceil_to_block";

const DEFAULT_VAT_RATE = 0.2;

/**
 * Ici on arrondit uniquement les produits qui doivent être commandés par blocs.
 * (tu peux ajuster si besoin)
 */
const ROUNDING_MODE_BY_PRODUCT: Record<ProductKind, RoundingMode> = {
  professions_de_foi: "ceil_to_block",
  bulletins_de_vote: "ceil_to_block",
  affiches: "none",
};

export function formatCents(cents: number, locale = "fr-FR"): string {
  const euros = cents / 100;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(euros);
}

function roundQuantityIfNeeded(qty: number, blocks: PricingBlockRow[], productKind: ProductKind): number {
  const mode = ROUNDING_MODE_BY_PRODUCT[productKind];
  if (mode === "none") return qty;

  const minBlock = Math.min(...blocks.map((b) => b.block_size));
  if (!Number.isFinite(minBlock) || minBlock <= 0) return qty;

  return Math.ceil(qty / minBlock) * minBlock;
}

function labelForBlock(productKind: ProductKind, seq: number, blockSize: number): string {
  if (productKind === "affiches" && blockSize === 10 && seq === 1) return "10 premières";
  if (productKind === "affiches" && blockSize === 1) return "Unité en plus";
  return `Palier ${seq} (bloc ${blockSize})`;
}

function matchBlocksForItem(item: CartItem, allBlocks: PricingBlockRow[]): PricingBlockRow[] {
  const base = allBlocks.filter((b) => b.product_kind === item.productKind && b.is_active);

  const filtered = base.filter((b) => {
    if (item.productKind === "professions_de_foi") {
      return b.impression === item.impression && b.bulletin_format === null && b.affiche_format === null;
    }
    if (item.productKind === "bulletins_de_vote") {
      return (
        b.impression === item.impression &&
        b.bulletin_format === item.bulletinFormat &&
        b.affiche_format === null
      );
    }
    return b.impression === null && b.bulletin_format === null && b.affiche_format === item.afficheFormat;
  });

  return filtered.sort((a, b) => a.seq - b.seq);
}

/**
 * ✅ VERSION “TABLEAU EXACT”
 *
 * On considère les lignes "Les X premiers" (max_applications = 1) comme des PRIX CUMULÉS.
 * Exemple:
 * - 10 000 premiers = prix total HT pour 10 000
 * - 30 000 premiers = prix total HT pour 30 000
 *
 * Donc :
 * 1) On prend le plus grand palier cumulé <= qty (base)
 * 2) On ajoute ensuite uniquement les lignes incrémentales ("mille suivant", "centaine suivante")
 *    qui viennent APRÈS ce palier.
 * 3) On IGNORE les autres paliers cumulés intermédiaires (sinon double comptage).
 */
function applyBlocksPricing(
  productKind: ProductKind,
  originalQty: number,
  blocks: PricingBlockRow[]
): { pricedQty: number; totalCents: MoneyCents; breakdown: PricingBreakdownRow[] } {
  if (blocks.length === 0) {
    throw new Error(`Aucune grille tarifaire trouvée pour ${productKind} (options sélectionnées).`);
  }

  const qty = roundQuantityIfNeeded(originalQty, blocks, productKind);

  // 1) paliers cumulés = max_applications === 1
  const cumulative = blocks
    .filter((b) => (b.max_applications ?? null) === 1)
    .sort((a, b) => a.block_size - b.block_size);

  // Trouve le palier cumulé le plus grand <= qty
  let base: PricingBlockRow | null = null;
  for (const c of cumulative) {
    if (c.block_size <= qty) base = c;
  }

  let covered = 0;
  let total = 0;
  const breakdown: PricingBreakdownRow[] = [];

  let startIndex = 0;

  if (base) {
    covered = base.block_size;
    total = base.block_price_cents;

    breakdown.push({
      seq: base.seq,
      label: labelForBlock(productKind, base.seq, base.block_size),
      blockSize: base.block_size,
      applications: 1,
      unitsCovered: base.block_size,
      blockPriceCents: base.block_price_cents,
      lineTotalCents: base.block_price_cents,
    });

    // point de départ après le palier base dans l'ordre seq
    startIndex = Math.max(0, blocks.findIndex((b) => b.id === base!.id) + 1);
  }

  // 2) On complète le reste uniquement avec les paliers INCRÉMENTAUX
  //    => on ignore max_applications === 1 (paliers cumulés) pour éviter double comptage
  let remaining = qty - covered;

  for (let i = startIndex; i < blocks.length; i++) {
    if (remaining <= 0) break;

    const b = blocks[i];

    // ignore tous les paliers cumulés (checkpoints)
    if ((b.max_applications ?? null) === 1) continue;

    const maxApps = b.max_applications ?? Number.POSITIVE_INFINITY;

    const neededApps = Math.ceil(remaining / b.block_size);
    const applications = Math.min(neededApps, maxApps);
    if (applications <= 0) continue;

    const unitsCovered = Math.min(remaining, applications * b.block_size);
    const lineTotal = applications * b.block_price_cents;

    total += lineTotal;

    breakdown.push({
      seq: b.seq,
      label: labelForBlock(productKind, b.seq, b.block_size),
      blockSize: b.block_size,
      applications,
      unitsCovered,
      blockPriceCents: b.block_price_cents,
      lineTotalCents: lineTotal,
    });

    remaining -= unitsCovered;
  }

  if (remaining > 0) {
    throw new Error(`Grille incomplète: il reste ${remaining} unités non tarifées pour ${productKind}.`);
  }

  return { pricedQty: qty, totalCents: total, breakdown };
}

export function priceCartItem(item: CartItem, allBlocks: PricingBlockRow[]): PricedItem {
  const blocks = matchBlocksForItem(item, allBlocks);
  const { pricedQty, totalCents, breakdown } = applyBlocksPricing(item.productKind, item.quantity, blocks);

  const unit = Math.round(totalCents / pricedQty);

  return {
    ...item,
    quantity: pricedQty,
    unitHtCents: unit,
    totalHtCents: totalCents,
    breakdown,
  };
}

export function priceOrder(items: CartItem[], allBlocks: PricingBlockRow[], vatRate = DEFAULT_VAT_RATE): PricedOrder {
  const pricedItems = items.map((it) => priceCartItem(it, allBlocks));
  const subtotal = pricedItems.reduce((sum, it) => sum + it.totalHtCents, 0);

  const vat = Math.round(subtotal * vatRate);
  const totalTtc = subtotal + vat;

  return {
    currency: "eur",
    vatRate,
    subtotalHtCents: subtotal,
    vatCents: vat,
    totalTtcCents: totalTtc,
    items: pricedItems,
  };
}
