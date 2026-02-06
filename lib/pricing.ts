// lib/pricing.ts
import type {
  AfficheFormat,
  BulletinFormat,
  CartItem,
  ImpressionType,
  MoneyCents,
  PricedItem,
  PricedOrder,
  PricingBlockRow,
  PricingBreakdownRow,
  ProductKind,
} from "@/types";

type RoundingMode = "none" | "ceil_to_block";

const DEFAULT_VAT_RATE = 0.2;

const ROUNDING_MODE_BY_PRODUCT: Record<ProductKind, RoundingMode> = {
  professions_de_foi: "ceil_to_block",
  bulletins_de_vote: "ceil_to_block",
  affiches: "none", // affiches: on facture au réel (10 premières + unités)
};

// si ceil_to_block : quel bloc sert de base d’arrondi ?
// => on prend le plus petit block_size des grilles pour ce produit/option
function roundQuantityIfNeeded(qty: number, blocks: PricingBlockRow[], productKind: ProductKind): number {
  const mode = ROUNDING_MODE_BY_PRODUCT[productKind];
  if (mode === "none") return qty;

  const minBlock = Math.min(...blocks.map((b) => b.block_size));
  if (!Number.isFinite(minBlock) || minBlock <= 0) return qty;

  return Math.ceil(qty / minBlock) * minBlock;
}

function labelForBlock(productKind: ProductKind, seq: number, blockSize: number): string {
  // Tu peux customiser selon tes libellés exacts (“1ère centaine”, “centaines suivantes”…)
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
    // affiches
    return b.impression === null && b.bulletin_format === null && b.affiche_format === item.afficheFormat;
  });

  return filtered.sort((a, b) => a.seq - b.seq);
}

/**
 * Applique une grille de "blocs" dans l’ordre:
 * - chaque bloc couvre block_size unités
 * - coûte block_price_cents
 * - max_applications limite combien de fois le bloc peut être appliqué (1 pour “10 premières”)
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

  let remaining = qty;
  let total = 0;
  const breakdown: PricingBreakdownRow[] = [];

  for (const b of blocks) {
    if (remaining <= 0) break;

    const maxApps = b.max_applications ?? Number.POSITIVE_INFINITY;

    // combien de blocs nécessaires pour couvrir le restant ?
    // ex bloc_size=100, remaining=250 => besoin 3 blocs si on arrondit par bloc (mais on a déjà arrondi globalement)
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
    // Il manque un palier (ex: tu as “1ère centaine” mais pas “centaines suivantes”)
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
    quantity: pricedQty, // quantité tarifée (après arrondi éventuel)
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
