import { getServiceSupabase } from "./supabase";
import type { CartItem, PriceCalculation, ProductType } from "@/types";

const TVA_BY_PRODUCT: Record<ProductType, number> = {
  affiches: 0.2,
  bulletins: 0.055,
  professions_foi: 0.055,
};

function calcAffichesHTCents(format: string, quantity: number) {
  const q = Math.max(1, Math.floor(quantity));

  if (format === "Grand format 594x841") {
    const base = 29700;
    const extra = 29;
    const extrasCount = Math.max(0, q - 10);
    return base + extrasCount * extra;
  }

  if (format === "Petit format 297x420") {
    const base = 9000;
    const extra = 12;
    const extrasCount = Math.max(0, q - 10);
    return base + extrasCount * extra;
  }

  throw new Error("Format affiches invalide");
}

export async function calculateItemPrice(item: CartItem): Promise<{
  unit_price_cents: number;
  line_total_cents: number;
  tva_rate: number;
  tva_cents: number;
}> {
  const tva_rate = TVA_BY_PRODUCT[item.product_type] ?? 0.2;

  if (item.product_type === "affiches") {
    const format = (item.options as any).format as string;
    const line_total_cents = calcAffichesHTCents(format, item.quantity);
    const unit_price_cents = Math.max(1, Math.round(line_total_cents / Math.max(1, item.quantity)));
    const tva_cents = Math.round(line_total_cents * tva_rate);
    return { unit_price_cents, line_total_cents, tva_rate, tva_cents };
  }

  const supabase = getServiceSupabase();

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("type", item.product_type)
    .eq("is_active", true)
    .single();

  if (!product) throw new Error(`Product not found: ${item.product_type}`);

  let query = supabase
    .from("pricing_rules")
    .select("unit_price_cents")
    .eq("product_id", product.id);

  if (item.product_type === "bulletins") {
    const format = (item.options as any).format as string;
    const impression = (item.options as any).impression as string;

    query = query
      .eq("format", format)
      .eq("finish_or_fold", impression)
      .is("color", null)
      .is("paper", null);
  }

  if (item.product_type === "professions_foi") {
    const impression = (item.options as any).impression as string;

    query = query
      .is("format", null)
      .eq("finish_or_fold", impression)
      .is("color", null)
      .is("paper", null);
  }

  const { data: pricingRule, error } = await query.single();

  if (error || !pricingRule) {
    throw new Error(`No pricing found for ${item.product_type} with given options`);
  }

  const unit_price_cents = pricingRule.unit_price_cents;
  const line_total_cents = unit_price_cents * item.quantity;
  const tva_cents = Math.round(line_total_cents * tva_rate);

  return { unit_price_cents, line_total_cents, tva_rate, tva_cents };
}

export async function calculateOrderTotal(items: CartItem[]): Promise<PriceCalculation> {
  const computed = await Promise.all(
    items.map(async (item) => {
      const res = await calculateItemPrice(item);
      return {
        product_type: item.product_type,
        product_name: item.product_name,
        options: item.options,
        quantity: item.quantity,
        unit_price_cents: res.unit_price_cents,
        line_total_cents: res.line_total_cents,
        tva_rate: res.tva_rate,
        tva_cents: res.tva_cents,
      };
    })
  );

  const subtotal_ht_cents = computed.reduce((s, it) => s + it.line_total_cents, 0);

  let shipping_cents = 0;
  if (subtotal_ht_cents < 10000) shipping_cents = 1500;

  const shipping_tva_rate = 0.2;
  const shipping_tva_cents = Math.round(shipping_cents * shipping_tva_rate);

  const tva_cents = computed.reduce((s, it) => s + it.tva_cents, 0) + shipping_tva_cents;
  const total_ttc_cents = subtotal_ht_cents + shipping_cents + tva_cents;

  return {
    items: computed,
    subtotal_ht_cents,
    tva_cents,
    shipping_cents,
    total_ttc_cents,
  };
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2) + " €";
}

export async function getProductsConfig() {
  const supabase = getServiceSupabase();

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("type");

  if (productsError) throw new Error("Failed to fetch products");

  const { data: options, error: optionsError } = await supabase
    .from("product_options")
    .select("*")
    .order("option_key, option_value");

  if (optionsError) throw new Error("Failed to fetch product options");

  const optionsByProduct: Record<ProductType, any> = {
    affiches: {},
    bulletins: {},
    professions_foi: {},
  };

  options.forEach((opt) => {
    const product = products.find((p) => p.id === opt.product_id);
    if (!product) return;

    const productType = product.type as ProductType;
    if (!optionsByProduct[productType][opt.option_key]) optionsByProduct[productType][opt.option_key] = [];
    optionsByProduct[productType][opt.option_key].push(opt.option_value);
  });

  return { products, options: optionsByProduct };
}
