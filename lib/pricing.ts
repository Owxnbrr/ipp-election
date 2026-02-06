import { getServiceSupabase } from './supabase';
import { CartItem, PriceCalculation, ProductType } from '@/types';

/**
 * Calcule le prix d'un item depuis la base de données
 * SOURCE DE VÉRITÉ : pricing_rules table
 */
export async function calculateItemPrice(item: CartItem): Promise<{
  unit_price_cents: number;
  line_total_cents: number;
}> {
  const supabase = getServiceSupabase();
  
  // Récupérer le product_id depuis le type
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('type', item.product_type)
    .eq('is_active', true)
    .single();
  
  if (!product) {
    throw new Error(`Product not found: ${item.product_type}`);
  }
  
  // Construire la requête de pricing selon le type de produit
  let query = supabase
    .from('pricing_rules')
    .select('unit_price_cents')
    .eq('product_id', product.id);
  
  // Ajouter les filtres selon les options
  if ('format' in item.options) {
    query = query.eq('format', item.options.format);
  }
  if ('couleur' in item.options) {
    query = query.eq('color', item.options.couleur);
  }
  if ('papier' in item.options) {
    query = query.eq('paper', item.options.papier);
  }
  
  // Gérer finition (affiches) ou pliage (professions_foi)
  if (item.product_type === 'affiches' && 'finition' in item.options) {
    query = query.eq('finish_or_fold', item.options.finition);
  } else if (item.product_type === 'professions_foi' && 'pliage' in item.options) {
    query = query.eq('finish_or_fold', item.options.pliage);
  } else if (item.product_type === 'bulletins') {
    query = query.is('finish_or_fold', null);
  }
  
  const { data: pricingRule, error } = await query.single();
  
  if (error || !pricingRule) {
    console.error('Pricing error:', error);
    throw new Error(`No pricing found for product ${item.product_type} with given options`);
  }
  
  const unit_price_cents = pricingRule.unit_price_cents;
  const line_total_cents = unit_price_cents * item.quantity;
  
  return {
    unit_price_cents,
    line_total_cents,
  };
}

/**
 * Calcule le prix total d'une commande
 * Applique la TVA et les frais de port
 */
export async function calculateOrderTotal(
  items: CartItem[]
): Promise<PriceCalculation> {
  // Calculer le prix de chaque item
  const itemsWithPrices = await Promise.all(
    items.map(async (item) => {
      const { unit_price_cents, line_total_cents } = await calculateItemPrice(item);
      return {
        product_type: item.product_type,
        product_name: item.product_name,
        options: item.options,
        quantity: item.quantity,
        unit_price_cents,
        line_total_cents,
      };
    })
  );
  
  // Calculer le sous-total HT
  const subtotal_ht_cents = itemsWithPrices.reduce(
    (sum, item) => sum + item.line_total_cents,
    0
  );
  
  // Calculer les frais de port (exemple simple)
  // Vous pouvez adapter cette logique selon vos besoins
  let shipping_cents = 0;
  if (subtotal_ht_cents < 10000) { // Moins de 100€ HT
    shipping_cents = 1500; // 15€ de frais de port
  }
  
  // Calculer la TVA (20%)
  const tva_rate = 0.20;
  const subtotal_with_shipping = subtotal_ht_cents + shipping_cents;
  const tva_cents = Math.round(subtotal_with_shipping * tva_rate);
  
  // Total TTC
  const total_ttc_cents = subtotal_with_shipping + tva_cents;
  
  return {
    items: itemsWithPrices,
    subtotal_ht_cents,
    tva_cents,
    shipping_cents,
    total_ttc_cents,
  };
}

/**
 * Formatte un montant en centimes en euros
 */
export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2) + ' €';
}

/**
 * Récupère la configuration des produits depuis la DB
 */
export async function getProductsConfig() {
  const supabase = getServiceSupabase();
  
  // Récupérer les produits
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('type');
  
  if (productsError) {
    throw new Error('Failed to fetch products');
  }
  
  // Récupérer les options
  const { data: options, error: optionsError } = await supabase
    .from('product_options')
    .select('*')
    .order('option_key, option_value');
  
  if (optionsError) {
    throw new Error('Failed to fetch product options');
  }
  
  // Organiser les options par produit
  const optionsByProduct: Record<ProductType, any> = {
    affiches: {},
    bulletins: {},
    professions_foi: {},
  };
  
  options.forEach((option) => {
    const product = products.find((p) => p.id === option.product_id);
    if (!product) return;
    
    const productType = product.type as ProductType;
    if (!optionsByProduct[productType][option.option_key]) {
      optionsByProduct[productType][option.option_key] = [];
    }
    optionsByProduct[productType][option.option_key].push(option.option_value);
  });
  
  return {
    products,
    options: optionsByProduct,
  };
}
