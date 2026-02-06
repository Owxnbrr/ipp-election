import { getServiceSupabase } from './supabase';
import type { CartItem, PriceCalculation, ProductType } from '@/types';

function fallbackVatRate(productType: ProductType) {
  if (productType === 'affiches') return 0.2;
  return 0.055;
}

function computeTierPriceCents(qty: number, firstQty: number, firstPrice: number, stepQty: number, stepPrice: number) {
  if (qty <= firstQty) return firstPrice;
  const remaining = qty - firstQty;
  const steps = Math.ceil(remaining / stepQty);
  return firstPrice + steps * stepPrice;
}

export async function calculateItemPrice(item: CartItem): Promise<{
  unit_price_cents: number;
  line_total_cents: number;
  vat_rate: number;
  vat_cents: number;
}> {
  const supabase = getServiceSupabase();

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('type', item.product_type)
    .eq('is_active', true)
    .single();

  if (!product) throw new Error(`Product not found: ${item.product_type}`);

  let query = supabase
    .from('pricing_rules')
    .select('first_qty, first_price_cents, step_qty, step_price_cents, unit_price_cents, vat_rate')
    .eq('product_id', product.id);

  if ('format' in item.options) query = query.eq('format', (item.options as any).format);
  if ('couleur' in item.options) query = query.eq('color', (item.options as any).couleur);
  if ('papier' in item.options) query = query.eq('paper', (item.options as any).papier);

  if (item.product_type === 'affiches' && 'finition' in item.options) {
    query = query.eq('finish_or_fold', (item.options as any).finition);
  } else if (item.product_type === 'professions_foi' && 'pliage' in item.options) {
    query = query.eq('finish_or_fold', (item.options as any).pliage);
  } else if (item.product_type === 'bulletins') {
    query = query.is('finish_or_fold', null);
  }

  const { data: rule, error } = await query.single();

  if (error || !rule) throw new Error(`No pricing found for ${item.product_type} with given options`);

  const vat_rate = typeof rule.vat_rate === 'number' ? rule.vat_rate : fallbackVatRate(item.product_type);

  const firstQty = rule.first_qty ?? null;
  const firstPrice = rule.first_price_cents ?? null;
  const stepQty = rule.step_qty ?? null;
  const stepPrice = rule.step_price_cents ?? null;

  let line_total_cents: number;

  if (firstQty && firstPrice != null && stepQty && stepPrice != null) {
    line_total_cents = computeTierPriceCents(item.quantity, firstQty, firstPrice, stepQty, stepPrice);
  } else {
    const unit = rule.unit_price_cents;
    if (typeof unit !== 'number') throw new Error('Pricing rule missing tier fields and unit_price_cents');
    line_total_cents = unit * item.quantity;
  }

  const unit_price_cents = Math.max(1, Math.round(line_total_cents / item.quantity));
  const vat_cents = Math.round(line_total_cents * vat_rate);

  return { unit_price_cents, line_total_cents, vat_rate, vat_cents };
}

export async function calculateOrderTotal(items: CartItem[]): Promise<PriceCalculation> {
  const itemsWithPrices = await Promise.all(
    items.map(async (item) => {
      const res = await calculateItemPrice(item);
      return {
        product_type: item.product_type,
        product_name: item.product_name,
        options: item.options,
        quantity: item.quantity,
        unit_price_cents: res.unit_price_cents,
        line_total_cents: res.line_total_cents,
        vat_rate: res.vat_rate,
        vat_cents: res.vat_cents,
      };
    })
  );

  const subtotal_ht_cents = itemsWithPrices.reduce((sum, it) => sum + it.line_total_cents, 0);

  let shipping_cents = 0;
  if (subtotal_ht_cents < 10000) shipping_cents = 1500;

  const shipping_vat_rate = 0.2;
  const shipping_vat_cents = Math.round(shipping_cents * shipping_vat_rate);

  const items_vat_cents = itemsWithPrices.reduce((sum, it) => sum + it.vat_cents, 0);

  const tva_cents = items_vat_cents + shipping_vat_cents;
  const total_ttc_cents = subtotal_ht_cents + shipping_cents + tva_cents;

  return {
    items: itemsWithPrices as any,
    subtotal_ht_cents,
    tva_cents,
    shipping_cents,
    total_ttc_cents,
  };
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2) + ' €';
}

export async function getProductsConfig() {
  const supabase = getServiceSupabase();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('type');

  if (productsError) throw new Error('Failed to fetch products');

  const { data: options, error: optionsError } = await supabase
    .from('product_options')
    .select('*')
    .order('option_key, option_value');

  if (optionsError) throw new Error('Failed to fetch product options');

  const optionsByProduct: Record<ProductType, any> = { affiches: {}, bulletins: {}, professions_foi: {} };

  (options || []).forEach((option: any) => {
    const product = (products || []).find((p: any) => p.id === option.product_id);
    if (!product) return;
    const productType = product.type as ProductType;

    if (!optionsByProduct[productType][option.option_key]) optionsByProduct[productType][option.option_key] = [];
    optionsByProduct[productType][option.option_key].push(option.option_value);
  });

  return { products, options: optionsByProduct };
}
