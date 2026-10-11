import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getPixGatewayState, PIX_GATEWAYS, savePixGateway } from "./pix-gateway.server";
import {
  deleteSagacePayKey,
  getSagacePayKeySource,
  saveSagacePayKey,
  testSagacePayKey,
} from "./sagacepay.server";
import {
  deleteMagicPayKeys,
  getMagicPayKeySource,
  saveMagicPayKeys,
  testMagicPayKeys,
} from "./magicpay.server";
import {
  deletePixgateKey,
  getPixgateKeySource,
  savePixgateKey,
  testPixgateKey,
} from "./pixgate.server";

const pw = z.object({ password: z.string().min(1).max(200) });
const gw = z.object({ gateway: z.enum(PIX_GATEWAYS) });

function assertAdmin(password: string) {
  if (password !== process.env["ADMIN_PASSWORD"]) throw new Error("Não autorizado");
}

function mask(token: string): string {
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

const KEYS = {
  sagacepay: {
    source: getSagacePayKeySource,
    save: saveSagacePayKey,
    remove: deleteSagacePayKey,
    test: testSagacePayKey,
  },
  pixgate: {
    source: getPixgateKeySource,
    save: savePixgateKey,
    remove: deletePixgateKey,
    test: testPixgateKey,
  },
  magicpay: {
    source: getMagicPayKeySource,
    save: async (_key: string) => {
      throw new Error("A MagicPay usa duas chaves: salve pela área da MagicPay.");
    },
    remove: deleteMagicPayKeys,
    test: testMagicPayKeys,
  },
} as const;

/** Gateway escolhido, gateway em uso e a chave de cada um (mascarada) com a origem. */
export const getPixGatewayStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const [state, sagacepay, pixgate, magicpay] = await Promise.all([
      getPixGatewayState(),
      KEYS.sagacepay.source(),
      KEYS.pixgate.source(),
      KEYS.magicpay.source(),
    ]);
    return {
      ...state,
      keys: {
        sagacepay: { key: sagacepay.key ? mask(sagacepay.key) : null, source: sagacepay.source },
        pixgate: { key: pixgate.key ? mask(pixgate.key) : null, source: pixgate.source },
        magicpay: { key: magicpay.key ? mask(magicpay.key) : null, source: magicpay.source },
      },
    };
  });

/** Troca o gateway dos Pix NOVOS. Pix já gerados continuam no gateway em que nasceram. */
export const setPixGatewayFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.merge(gw).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await savePixGateway(data.gateway);
    return { ok: true };
  });

export const saveGatewayKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    pw
      .merge(gw)
      .extend({ key: z.string().trim().min(10).max(500) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await KEYS[data.gateway].save(data.key);
    return { ok: true };
  });

export const deleteGatewayKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.merge(gw).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await KEYS[data.gateway].remove();
    return { ok: true };
  });

/** Valida a chave do gateway sem gerar cobrança nenhuma. */
export const testGatewayKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.merge(gw).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return KEYS[data.gateway].test();
  });

/** MagicPay: salva as duas chaves juntas (pública pk_… e secreta sk_…). */
export const saveMagicPayKeysFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    pw
      .extend({
        publicKey: z.string().trim().min(10).max(500),
        secretKey: z.string().trim().min(10).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await saveMagicPayKeys({ publicKey: data.publicKey, secretKey: data.secretKey });
    return { ok: true };
  });
