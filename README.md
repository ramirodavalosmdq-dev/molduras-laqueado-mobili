# Molduras Laqueado — Mobili

PWA standalone para calcular medidas de corte de los **3 modelos de moldura** utilizados en Mobili:

1. **Step (Escalonada)** — base 12 mm + 2 fajas apiladas de 3 mm (6,3 + 6 cm)
2. **Media caña (Fresada)** — 3 placas apiladas (9+9+18 mm) con surco cóncavo perimetral
3. **Simple Placar** — base 12 mm + 1 faja perimetral de 5 mm (8 cm)

Funciona offline, instalable como app en celular, con historial unificado y filtros por modelo.

## Estructura

```
molduras-laqueado-mobili/
├── index.html              # UI principal con selector de modelo
├── app.js                  # Lógica de cálculo, historial, impresión
├── sw.js                   # Service worker (offline)
├── manifest.json           # Manifest PWA
├── icon.svg                # Ícono principal
├── icon-maskable.svg       # Ícono maskable (safe zone)
├── icon-192.png            # 192x192
├── icon-512.png            # 512x512
├── icon-maskable-512.png   # 512x512 maskable
├── favicon.png             # 48x48
├── _headers                # Headers Netlify (seguridad + cache)
├── netlify.toml            # Config Netlify
├── .gitignore
└── README.md
```

## Deploy

### Opción A — Netlify conectado a GitHub (recomendado)

1. En Netlify: **Add new site** → **Import from Git** → GitHub → seleccionar este repo
2. Branch: `main` · Build command: (vacío) · Publish directory: `.`
3. Deploy
4. Cada `git push` a `main` dispara un deploy automático (sin consumir créditos manuales)

### Opción B — Drag-and-drop manual
Arrastrar la carpeta completa al drop zone de Netlify.

## URL sugerida

`molduras-mobili.netlify.app` (Site settings → Change site name)

## Uso

1. Elegir **modelo** arriba (Step / Media caña / Simple Placar)
2. Cargar **cliente** y **N° de orden** (opcional, persistentes)
3. Cargar **alto, ancho y cantidad** del frente, y elegir el **refilado** de ese frente (1 cm, 0,5 cm u otro)
4. La app muestra el despiece calculado en vivo
5. Acciones:
   - **Copiar / Compartir / Imprimir** — individual
   - **Guardar** — guarda en historial (hasta 30 frentes)
6. En el historial:
   - **Filtrar** por modelo
   - **Cargar** un frente guardado para editar
   - **Imprimir orden de corte** — PDF consolidado agrupado por operación
   - **Imprimir corte por medida** — PDF agrupado por ancho de tira

## Fórmulas

Todas en cm. `H` × `A` = medida final del frente (con canto), `r` = refilado por lado
(elegido por frente: 1 cm, 0,5 cm u otro). El canto es de 1 mm por borde, así que
cada dimensión del frente descuenta 0,2 cm y cada faja descuenta 0,1 cm (un solo borde exterior).

### Comunes a los 3 modelos

- Medida al corte: `(H − 0,2 + 2r) × (A − 0,2 + 2r)` → `altoCorte × anchoCorte`
- Refilado (antes de pegar el canto): `(H − 0,2) × (A − 0,2)`
- Ancho de faja al corte: `faja − 0,1 + r`

### Modelo 1 — Step

- Base 12 mm: `altoCorte × anchoCorte`
- Faja C2 vertical (3 mm): `altoCorte × (c2 − 0,1 + r)`
- Faja C2 horizontal (3 mm): `(c2 − 0,1 + r) × (anchoCorte − 2(c2 − 0,1 + r))`
- Faja C3 vertical/horizontal: igual con `c3`

Ejemplo 98 × 68, r = 1: base 99,8 × 69,8 · C2 7,2 cm (horizontal 55,4) · C3 6,9 cm (horizontal 56)

### Modelo 2 — Media caña

- Corte 3 placas (9 + 9 + 18 mm): `altoCorte × anchoCorte` cada una
- Moldura interior (fresa): `(H − 2(marco + surco)) × (A − 2(marco + surco))`
- Refilado post-armado: `(H − 0,2) × (A − 0,2)`

Ejemplo 98 × 68, r = 1: placas 99,8 × 69,8 · fresa 80 × 50 · refilado 97,8 × 67,8

### Modelo 3 — Simple Placar

- Base 12 mm: `altoCorte × anchoCorte`
- Faja vertical (5 mm): `altoCorte × (faja − 0,1 + r)`
- Faja horizontal (5 mm): `(faja − 0,1 + r) × (anchoCorte − 2(faja − 0,1 + r))`
- Refilado post-armado: `(H − 0,2) × (A − 0,2)`

Ejemplo 98 × 68, r = 1: base 99,8 × 69,8 · faja 8,9 cm (horizontal 52)

## Configuración por defecto

- Refilado por lado: **1 cm**
- Step — faja C2: **6,3 cm** final · faja C3: **6 cm** final
- Media caña — marco perimetral: **5,5 cm** · surco: **3,5 cm**
- Simple Placar — faja: **8 cm** final

Todos los valores son editables en "Configuración avanzada" y se persisten en localStorage.

## Stack

- HTML + CSS + JS vanilla (sin frameworks)
- Service Worker (red primero, caché solo sin conexión: después de cada deploy un refresco alcanza)
- localStorage para config, historial y modelo activo
- Web Share API + Clipboard API con fallback

## Compatibilidad

- Chrome / Edge / Firefox / Safari modernos
- Instalable como PWA en iOS Safari ≥ 13 y Android Chrome ≥ 80

---

v1.0 · Mobili · Mar del Plata
