# Vitrine Feminina

Loja de calçados femininos, bolsas e acessórios (247 produtos), feita a partir da estrutura da loja
CardioMed: painel `/admin` com pedidos, lucro, checkouts abandonados, preços e integrações; checkout
Pix com cupom, order bump, upsell pós-compra, seguro e envio expresso; UTMify, Meta (pixel + API de
Conversões), Pushcut e Rotasync.

**Pagamento: Pix, pela SagacePay, PixGate ou MagicPay.** No `/admin` → Integrações você escolhe
qual gera os próximos Pix. Cada pedido guarda em qual gateway nasceu, então status, webhook
(`/api/public/pix-webhook`), upsell, envio expresso e relatórios consultam sempre o gateway certo.

## Antes de publicar

- **Banco**: ative o Lovable Cloud neste projeto (projeto novo, não use o banco da CardioMed) e rode
  as migrações de `supabase/migrations`.
- **Segredos** (Lovable Cloud): `ADMIN_PASSWORD` (senha do `/admin`), `RASTREIO_API_KEY` (Rotasync;
  opcional `RASTREIO_API_URL`). As chaves da SagacePay, PixGate e MagicPay são cadastradas no
  `/admin` → Integrações (com botão de testar). UTMify, Meta e Pushcut também ficam no `/admin`.
- **Marca e empresa**: `src/lib/brand.ts` (razão social, CNPJ, e-mail, domínio, Instagram, cupom).
- **Pixels do `<head>`**: `src/lib/pixels.ts` (Meta, TikTok, UTMify).

## Onde fica cada coisa

| O quê | Arquivo |
|---|---|
| Catálogo (produtos, categorias, fotos) | `src/data/catalog.json` e `src/data/descriptions.json` |
| Regras de preço: kit 3 por R$ 99, promoção dos Tênis (1/2/3 unidades), Modare no topo | `src/lib/catalog.ts` (`PRICING`, `PINNED_BRANDS`) |
| Sacola, validação dos itens, cupom e frete grátis | `src/lib/cart.ts` |
| Frete grátis por valor | `src/lib/shipping.ts` |
| Oferta do checkout (meias) | `src/lib/order-bump.ts` |
| Upsell (+1 igual com desconto), seguro e envio expresso | `src/lib/upsell.ts` |
| Vitrine (home, listagens, produto, menu, sacola) | `src/components/store/` e `src/store.css` |

Os preços do kit, da promoção dos Tênis, do order bump, do upsell, do seguro e do envio expresso
também podem ser alterados no `/admin` → Preços (vale na hora; o servidor sempre recalcula antes de
cobrar).

## Atualizar o catálogo

```sh
sh tools/atualizar_catalogo.sh
```

Baixa os produtos da loja WooCommerce de origem e regenera `src/data/`.

## Desenvolvimento

```sh
npm i
npm run dev
npm test
```
