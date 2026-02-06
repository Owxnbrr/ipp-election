import { getServiceSupabase } from "./supabase";
import type { CartItem, PriceCalculation, ProductType } from "@/types";

export const VAT_RATES: Record<ProductType, number> = {
  affiches: 0.2,
  bulletins: 0.055,
  professions_foi: 0.055,
};

export async function calculateItemPrice(item: CartItem): Promise<{
  unit_price_cents: number;
  line_total_cents: number;
}> {
  const supabase = getServiceSupabase();

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("type", item.product_type)
    .eq("is_active", true)
    .single();

  if (!product) {
    throw new Error(`Product not found: ${item.product_type}`);
  }

  let query = supabase.from("pricing_rules").select("unit_price_cents").eq("product_id", product.id);

  if ("format" in item.options) query = query.eq("format", item.options.format);
  if ("couleur" in item.options) query = query.eq("color", item.options.couleur);
  if ("papier" in item.options) query = query.eq("paper", item.options.papier);

  if (item.product_type === "affiches" && "finition" in item.options) {
    query = query.eq("finish_or_fold", item.options.finition);
  } else if (item.product_type === "professions_foi" && "pliage" in item.options) {
    query = query.eq("finish_or_fold", item.options.pliage);
  } else if (item.product_type === "bulletins") {
    query = query.is("finish_or_fold", null);
  }

  const { data: pricingRule, error } = await query.single();

  if (error || !pricingRule) {
    throw new Error(`No pricing found for product ${item.product_type} with given options`);
  }

  const unit_price_cents = pricingRule.unit_price_cents;
  const line_total_cents = unit_price_cents * item.quantity;

  return { unit_price_cents, line_total_cents };
}

export async function calculateOrderTotal(items: CartItem[]): Promise<PriceCalculation> {
  const itemsWithPrices = await Promise.all(
    items.map(async (item) => {
      const { unit_price_cents, line_total_cents } = await calculateItemPrice(item);
      const vat_rate = VAT_RATES[item.product_type] ?? 0.2;
      const vat_cents = Math.round(line_total_cents * vat_rate);

      return {
        product_type: item.product_type,
        product_name: item.product_name,
        options: item.options,
        quantity: item.quantity,
        unit_price_cents,
        line_total_cents,
        vat_rate,
        vat_cents,
      };
    })
  );

  const subtotal_ht_cents = itemsWithPrices.reduce((sum, it) => sum + it.line_total_cents, 0);

  let shipping_cents = 0;
  if (subtotal_ht_cents < 10000) shipping_cents = 1500;

  const shipping_vat_rate = 0.2;
  const shipping_vat_cents = shipping_cents > 0 ? Math.round(shipping_cents * shipping_vat_rate) : 0;

  const vat_cents = itemsWithPrices.reduce((sum, it) => sum + it.vat_cents, 0) + shipping_vat_cents;

  const total_ttc_cents = subtotal_ht_cents + shipping_cents + vat_cents;

  return {
    items: itemsWithPrices,
    subtotal_ht_cents,
    vat_cents,
    shipping_cents,
    shipping_vat_cents,
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

  if (productsError || !products) throw new Error("Failed to fetch products");

  const { data: options, error: optionsError } = await supabase
    .from("product_options")
    .select("*")
    .order("option_key, option_value");

  if (optionsError || !options) throw new Error("Failed to fetch product options");

  const optionsByProduct: Record<ProductType, any> = {
    affiches: {},
    bulletins: {},
    professions_foi: {},
  };

  options.forEach((option: any) => {
    const product = products.find((p: any) => p.id === option.product_id);
    if (!product) return;

    const productType = product.type as ProductType;
    if (!optionsByProduct[productType][option.option_key]) {
      optionsByProduct[productType][option.option_key] = [];
    }
    optionsByProduct[productType][option.option_key].push(option.option_value);
  });

  return { products, options: optionsByProduct };
}
