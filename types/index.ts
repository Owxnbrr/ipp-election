// types/index.ts

export type ProductKind = "professions_de_foi" | "bulletins_de_vote" | "affiches";
export type ImpressionType = "recto" | "recto_verso";
export type BulletinFormat = "liste_5_31" | "liste_32_plus";
export type AfficheFormat = "grand_format" | "petit_format";

export type MoneyCents = number;

export type CartItem =
  | {
      productKind: "professions_de_foi";
      quantity: number;
      impression: ImpressionType;
    }
  | {
      productKind: "bulletins_de_vote";
      quantity: number;
      impression: ImpressionType;
      bulletinFormat: BulletinFormat;
    }
  | {
      productKind: "affiches";
      quantity: number;
      afficheFormat: AfficheFormat;
    };

export type PricingBreakdownRow = {
  seq: number;
  label: string;
  blockSize: number;
  applications: number;
  unitsCovered: number;
  blockPriceCents: MoneyCents;
  lineTotalCents: MoneyCents;
};

export type PricedItem = CartItem & {
  unitHtCents: MoneyCents;
  totalHtCents: MoneyCents;
  breakdown: PricingBreakdownRow[];
};

export type PricedOrder = {
  currency: "eur";
  vatRate: number; // e.g. 0.2
  subtotalHtCents: MoneyCents;
  vatCents: MoneyCents;
  totalTtcCents: MoneyCents;
  items: PricedItem[];
};

export type PricingBlockRow = {
  id: string;
  product_kind: ProductKind;

  impression: ImpressionType | null;
  bulletin_format: BulletinFormat | null;
  affiche_format: AfficheFormat | null;

  seq: number;
  block_size: number;
  block_price_cents: MoneyCents;
  max_applications: number | null;
  is_active: boolean;
};
