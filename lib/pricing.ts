// lib/pricing.ts
import type {
  CartItem,
  MoneyCents,
  PricedOrder,
  PricingBlockRow,
  PricingBreakdownRow,
  ProductKind,
} from "@/types";

type RoundingMode = "none" | "ceil_to_block";

const ROUNDING_MODE_BY_PRODUCT: Record<ProductKind, RoundingMode> = {
  professions_de_foi: "ceil_to_block",
  bulletins_de_vote: "ceil_to_block",
  affiches: "none",
};

export const VAT_RATE_BY_PRODUCT: Record<ProductKind, number> = {
  professions_de_foi: 0.055,
  bulletins_de_vote: 0.055,
  affiches: 0.2,
};

export function formatCents(cents: number, locale = "fr-FR"): string {
  const euros = cents / 100;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(euros);
}

/**
 * OPTION B (arrondi "doux") :
 * - Professions de foi / Bulletins :
 *   - jusqu’à 1000 => arrondi à la centaine sup.
 *   - au-delà => arrondi au 500 sup.
 * - Affiches : pas d’arrondi
 */
function roundQuantityForProduct(qty: number, productKind: ProductKind): number {
  const mode = ROUNDING_MODE_BY_PRODUCT[productKind];
  if (mode === "none") return qty;

  // ✅ Bulletins : au-delà de 1000 => arrondi au 1000 (tes blocs sont en 1000)
  if (productKind === "bulletins_de_vote") {
    if (qty <= 1000) return Math.ceil(qty / 100) * 100;
    return Math.ceil(qty / 500) * 500;
  }

  // ✅ Professions de foi : option B (500)
  if (qty <= 1000) return Math.ceil(qty / 100) * 100;
  return Math.ceil(qty / 500) * 500;
}


function inRange(b: PricingBlockRow, qty: number): boolean {
  const min = b.range_min ?? -Infinity;
  const max = b.range_max ?? Infinity;
  return qty >= min && qty <= max;
}

function labelForBlock(productKind: ProductKind, seq: number, blockSize: number): string {
  if (productKind === "affiches" && blockSize === 10 && seq === 1) return "10 premières";
  if (productKind === "affiches" && blockSize === 1) return "Unité en plus";
  return `Palier ${seq} (bloc ${blockSize})`;
}

/**
 * Sélectionne la bonne grille :
 * - même product_kind + options (impression / formats)
 * - ET une seule tranche range_min/range_max (sur la quantité arrondie)
 *
 * ✅ Fix : on ne garde qu'UNE tranche (la plus spécifique = range_min le plus élevé),
 * sinon tu additionnes plusieurs "bases" (100 + 1000 + 10000 + 30000...) et le prix explose.
 */
function matchBlocksForItem(item: CartItem, allBlocks: PricingBlockRow[]): PricingBlockRow[] {
  const base = allBlocks.filter((b) => b.product_kind === item.productKind && b.is_active);

  const filteredByOptions = base.filter((b) => {
    if (item.productKind === "professions_de_foi") {
      return b.impression === item.impression && b.bulletin_format == null && b.affiche_format == null;
    }
    if (item.productKind === "bulletins_de_vote") {
      return (
        b.impression === item.impression &&
        b.bulletin_format === item.bulletinFormat &&
        b.affiche_format == null
      );
    }
    // affiches
    return b.impression == null && b.bulletin_format == null && b.affiche_format === item.afficheFormat;
  });

  const roundedQty = roundQuantityForProduct(item.quantity, item.productKind);

  // 1) On garde toutes les lignes qui matchent la quantité
  const candidates = filteredByOptions.filter((b) => inRange(b, roundedQty));
  if (candidates.length === 0) return [];

  // 2) On choisit UNE seule tranche : celle dont range_min est le plus grand (la plus spécifique)
  const bestRangeMin = Math.max(...candidates.map((b) => b.range_min ?? -Infinity));

  // 3) On garde uniquement les lignes de cette tranche
  const best = candidates.filter((b) => (b.range_min ?? -Infinity) === bestRangeMin);

  // 4) Tri final
  return best.sort((a, b) => a.seq - b.seq);
}

/**
 * Calcule le prix via les blocs :
 * - seq=1 = “base” (ex: première centaine / premier mille / les 10 000 premières etc)
 * - seq>1 = incréments (ex: +100 / +500 / +1000 etc) selon block_size
 */
function applyBlocksPricing(
  productKind: ProductKind,
  originalQty: number,
  blocks: PricingBlockRow[]
): { pricedQty: number; totalCents: MoneyCents; breakdown: PricingBreakdownRow[] } {
  if (blocks.length === 0) {
    throw new Error(`Aucune grille tarifaire trouvée pour ${productKind} (options sélectionnées).`);
  }

  const qty = roundQuantityForProduct(originalQty, productKind);

  let remaining = qty;
  let total = 0;
  const breakdown: PricingBreakdownRow[] = [];

  for (const b of blocks) {
    if (remaining <= 0) break;

    const maxApps = b.max_applications ?? Number.POSITIVE_INFINITY;

    // Combien d'applications de ce bloc il faut pour couvrir le remaining
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

export function priceCartItem(
  item: CartItem,
  allBlocks: PricingBlockRow[]
): {
  quantity: number;
  unitHtCents: number;
  totalHtCents: number;
  breakdown: PricingBreakdownRow[];
  vatRate: number;
  vatCents: number;
  totalTtcCents: number;
} & CartItem {
  const blocks = matchBlocksForItem(item, allBlocks);
  const { pricedQty, totalCents, breakdown } = applyBlocksPricing(item.productKind, item.quantity, blocks);

  const unit = Math.round(totalCents / pricedQty);
  const vatRate = VAT_RATE_BY_PRODUCT[item.productKind];
  const vatCents = Math.round(totalCents * vatRate);
  const totalTtcCents = totalCents + vatCents;

  return {
    ...item,
    quantity: pricedQty,
    unitHtCents: unit,
    totalHtCents: totalCents,
    breakdown,
    vatRate,
    vatCents,
    totalTtcCents,
  };
}

export function priceOrder(items: CartItem[], allBlocks: PricingBlockRow[]): PricedOrder & {
  subtotalHtCents: number;
  vatCents: number;
  totalTtcCents: number;
  items: Array<any>;
} {
  const pricedItems = items.map((it) => priceCartItem(it, allBlocks));
  const subtotalHt = pricedItems.reduce((sum, it) => sum + it.totalHtCents, 0);
  const vat = pricedItems.reduce((sum, it) => sum + it.vatCents, 0);
  const totalTtc = subtotalHt + vat;

  return {
    currency: "eur",
    vatRate: 0,
    subtotalHtCents: subtotalHt,
    vatCents: vat,
    totalTtcCents: totalTtc,
    items: pricedItems,
  } as any;
}
