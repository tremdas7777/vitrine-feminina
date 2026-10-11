# Vitrine Feminina

Loja virtual de calçados femininos, bolsas e acessórios: sandálias, chinelos, tênis, sapatilhas, scarpins, mocassins, botas, bolsas e linha infantil.

Site estático (HTML, CSS e JavaScript puro, sem build), com:

- 247 produtos organizados em 8 categorias e subcategorias
- **Mais vendidos**: ranking real de vendas, com carrossel numerado e página própria
- **Kit 3 por R$ 99** em todos os modelos com mais de uma cor, com cor e tamanho escolhidos para cada unidade
- Filtros por marca, tamanho, cor e preço, além de busca com sugestões
- Favoritos, sacola com cupom (`PRIMEIRA10`) e pedido finalizado pelo WhatsApp

## Rodar localmente

```sh
python3 -m http.server 8080
```

Depois é só abrir http://localhost:8080.

## Publicar

Como é um site estático, dá para hospedar direto na Vercel, na Netlify ou no GitHub Pages, sem nenhuma configuração de build.

## Atualizar o catálogo

```sh
sh tools/atualizar_catalogo.sh
```

Esse script baixa os produtos da loja WooCommerce de origem e regenera `data/products.js`.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Estrutura da página |
| `styles.css` | Visual da loja |
| `app.js` | Rotas, catálogo, filtros, sacola e kits |
| `data/products.js` | Catálogo de produtos |
| `tools/` | Scripts para atualizar o catálogo |

Para trocar o número de WhatsApp, o Instagram, o cupom ou o preço do kit, edite as constantes no topo de `app.js`.
