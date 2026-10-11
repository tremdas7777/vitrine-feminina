#!/bin/sh
# Baixa os produtos atuais da loja WooCommerce e regenera data/products.js
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
API="https://samisapatilhasecia.com.br/wp-json/wc/store/v1/products"
for p in 1 2 3; do
  curl -sL "$API?per_page=100&page=$p" -o "$TMP/p$p.json"
  curl -sL "$API?per_page=100&page=$p&orderby=popularity&order=desc&_fields=id" -o "$TMP/pop$p.json"
done
python3 -I "$DIR/build_catalogo.py" "$TMP" "$DIR/../data/products.js"
rm -rf "$TMP"
