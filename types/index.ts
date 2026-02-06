export type ProductType = "affiches" | "bulletins" | "professions_foi";

export interface Product {
  id: string;
  type: ProductType;
  name: string;
  is_active: boolean;
}

export interface ProductOption {
  id: string;
  product_id: string;
  option_key: string;
  option_value: string;
}

export interface PricingRule {
  id: string;
  product_id: string;
  format: string | null;
  color: string | null;
  paper: string | null;
  finish_or_fold: string | null;
  unit_price_cents: number;
}

export type ImpressionMode = "Recto" | "Recto/verso";

export interface AffichesOptions {
  format: "Grand format 594x841" | "Petit format 297x420";
}

export interface BulletinsOptions {
  format: string;
  impression: ImpressionMode;
}

export interface ProfessionsFoiOptions {
  impression: ImpressionMode;
}

export type ProductOptions = AffichesOptions | BulletinsOptions | ProfessionsFoiOptions;

export interface CartItem {
  product_type: ProductType;
  product_name: string;
  options: ProductOptions;
  quantity: number;
  unit_price_cents?: number;
  line_total_cents?: number;
}

export interface Address {
  street: string;
  postal_code: string;
  city: string;
  country?: string;
}

export interface MairieInfo {
  mairie_name: string;
  commune: string;
  email: string;
  phone: string;
  billing_address: Address;
  shipping_address: Address;
  same_as_billing?: boolean;
}

export interface Order {
  id: string;
  status: "pending" | "paid" | "processing" | "shipped" | "cancelled";
  total_ht_cents: number;
  tva_rate: number;
  total_ttc_cents: number;
  shipping_cents: number;
  currency: string;
  customer_email: string;
  customer_name?: string;
  customer_phone?: string;
  mairie_name: string;
  commune: string;
  billing_address: Address;
  shipping_address: Address;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_type: ProductType;
  product_name: string;
  options: ProductOptions;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export interface CreateOrderPayload {
  items: CartItem[];
  mairie_info: MairieInfo;
  accept_cgv: boolean;
}

export interface PriceCalculation {
  items: Array<{
    product_type: ProductType;
    product_name: string;
    options: ProductOptions;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
    tva_rate: number;
    tva_cents: number;
  }>;
  subtotal_ht_cents: number;
  tva_cents: number;
  shipping_cents: number;
  total_ttc_cents: number;
}

export interface ProductConfig {
  products: Product[];
  options: Record<
    ProductType,
    {
      format?: string[];
      impression?: ImpressionMode[];
    }
  >;
}
