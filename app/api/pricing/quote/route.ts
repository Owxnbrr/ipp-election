import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { CartItem, PricingBlockRow } from "@/types";
import { priceOrder } from "@/lib/pricing";

const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const professionsItemSchema = z.object({
  productKind: z.literal("professions_de_foi"),
  quantity: z.number().int().positive(),
  impression: z.enum(["recto", "recto_verso"]),
});

const bulletinsItemSchema = z.object({
  productKind: z.literal("bulletins_de_vote"),
  quantity: z.number().int().positive(),
  impression: z.enum(["recto", "recto_verso"]),
  bulletinFormat: z.enum(["liste_5_31", "liste_32_plus"]),
});

const affichesItemSchema = z.object({
  productKind: z.literal("affiches"),
  quantity: z.number().int().positive(),
  afficheFormat: z.enum(["grand_format", "petit_format"]),
});

const cartItemSchema = z.discriminatedUnion("productKind", [
  professionsItemSchema,
  bulletinsItemSchema,
  affichesItemSchema,
]);

const bodySchema = z.object({
  items: z.array(cartItemSchema).min(1),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = bodySchema.parse(json);

    const { data: blocks, error } = await supabaseAdmin
      .from("pricing_blocks")
      .select("*")
      .eq("is_active", true);

    if (error) throw error;

    const allBlocks = (blocks ?? []) as PricingBlockRow[];
    const priced = priceOrder(body.items as CartItem[], allBlocks);

    return NextResponse.json(priced, { status: 200 });
  } catch (err) {
    console.error("QUOTE_ERROR:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
