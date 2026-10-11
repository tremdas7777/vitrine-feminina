import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Descrição do produto (fica só no servidor, para não pesar o catálogo do navegador). */
export const getProductTexts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(200) }).parse(d))
  .handler(async ({ data }): Promise<{ short: string; desc: string } | null> => {
    const texts = (await import("@/data/descriptions.json")).default as Record<
      string,
      { short: string; desc: string }
    >;
    return texts[data.slug] ?? null;
  });
