# Molduras Laqueado — MOBILI
### Especificaciones técnicas definitivas para construir la app

---

## QUÉ ES

PWA calculadora de medidas de corte para los 3 modelos de moldura que se producen en MOBILI (sector laqueado).

**Repo:** `ramirodavalosmdq-dev/molduras-laqueado-mobili` (GitHub, ya creado)
**Deploy:** GitHub Pages (branch `main`, carpeta raíz; cada push publica solo). Sin Netlify.
**URL:** `https://ramirodavalosmdq-dev.github.io/molduras-laqueado-mobili/`
**Stack:** HTML + CSS + JS vanilla. Sin frameworks. PWA offline con service worker.
**Paleta:** navy MOBILI (`#0F2C6B` principal) + blanco + grises. Fuente **Poppins**.

---

## FÓRMULA ÚNICA (aplica a los 3 modelos)

**Constantes:**
- `CANTO` = **0,1 cm** por borde (1 mm × 4 bordes canteados = 0,2 cm por dimensión)
- `r` = refilado por lado (configurable, **default 1 cm**)

**Para el FRENTE completo** (base y perímetro externo):
- **Medida al corte** (lo que se pide a la sierra) = `FINAL − 0,2 + 2 × r`
- **Medida después del refilado** (antes de pegar el canto) = `FINAL − 0,2`
- **Medida final real** = la del plano (después de pegar el canto)

**Para las FAJAS** (ancho de la faja perimetral, Step y Simple Placar):
- **Ancho de corte** = `FAJA_FINAL − 0,1 + r` (solo 1 borde exterior se refila)

**Para las HORIZONTALES** (fajas que calzan entre las verticales):
- **Largo** = `ancho_corte_frente − 2 × ancho_corte_faja`

**Ejemplos validados (NO cambiar):**

Frente **40 × 50** final, r=1:
- Corte: **41,8 × 51,8** · Refilado: **39,8 × 49,8**

Frente **40 × 50** final, r=0,5:
- Corte: **40,8 × 50,8** · Refilado: **39,8 × 49,8**

Faja Step C2 (**6,3 cm** final), r=1 → corte **7,2 cm**
Faja Step C3 (**6 cm** final), r=1 → corte **6,9 cm**

---

## LOS 3 MODELOS

### MODELO 1 — STEP (Escalonada)
**Composición:** 9 piezas en total
- 1 pieza MDF **12 mm** → base (medida completa del frente)
- 2 piezas MDF **3 mm** → fajas verticales Capa 2 (ancho final **6,3 cm**)
- 2 piezas MDF **3 mm** → fajas horizontales Capa 2
- 2 piezas MDF **3 mm** → fajas verticales Capa 3 (ancho final **6 cm** — más angosta, genera el escalón)
- 2 piezas MDF **3 mm** → fajas horizontales Capa 3

**Espesor total:** 18 mm. **Ensamblaje:** verticales enteras + horizontales entre medio (90°, sin mitra).

### MODELO 2 — MEDIA CAÑA (Fresada)
**Composición:** 3 placas apiladas que se mecanizan juntas
- 1 placa MDF **9 mm** (cara superior)
- 1 placa MDF **9 mm** (cara inferior)
- 1 placa MDF **18 mm** (base para mecanizado)

**Espesor total:** 36 mm. **Terminación:** surco perimetral fresa cóncava en cara visible. Canteado 4 bordes siempre.

**Config de la moldura:**
- Marco perimetral visible: **5,5 cm** por lado
- Surco media caña: **3,5 cm** por lado
- Moldura interior (marcación para la fresa) = `FINAL − 2 × (marco + surco)` = `FINAL − 18 cm`
- Validación: si `ancho final < 18 cm` → NO se puede moldurar

### MODELO 3 — SIMPLE PLACAR
**Composición:** 2 capas apiladas
- 1 pieza MDF **12 mm** → base (medida completa)
- 2 piezas MDF **5 mm** → fajas verticales (ancho final **8 cm**)
- 2 piezas MDF **5 mm** → fajas horizontales

**Espesor total:** 17 mm. **Canteado 4 bordes siempre**. Ensamblaje igual que Step.

---

## FEATURES DE LA APP

### UI principal
- **Header navy MOBILI** con cuadrado marco blanco (ícono del logo real) + tipografía Poppins ExtraBold
- Subtítulo header: **"MOLDURAS LAQUEADO"**
- **Selector de modelo:** 3 cards grandes clickeables arriba (Step / Media caña / Simple Placar), cada una con icono SVG y descripción corta
- **Formulario adaptado** al modelo activo
- Modo claro + dark mode automático según sistema

### Campos de entrada (por frente)
- **Cliente** (texto libre, opcional, persistente)
- **N° de orden** (texto libre, opcional, persistente)
- **Alto** (cm) · **Ancho** (cm) · **Cantidad** (en una sola fila de 3 columnas)
- **Refilado para este frente:** 3 chips → `1 cm/lado` (default activo) · `0,5 cm/lado` · `Otro` (abre input numérico)

### Config avanzada (plegable al fondo)
- **Refilado por defecto** (cm/lado) → arranca en 1, cambia para frentes nuevos
- **Step:** ancho faja C2 final (6,3) · ancho faja C3 final (6)
- **Media caña:** marco perimetral (5,5) · surco (3,5)
- **Simple Placar:** ancho faja final (8)
- Botón **"Restaurar valores por defecto"**
- Todos los valores persisten en `localStorage`

### Resultado en pantalla (3 stats arriba del despiece)
1. **Medida final** (lo que cargó el usuario, con "×N" si cant > 1)
2. **Medida al corte** (con indicador del refilado usado)
3. **Refilado post-armado** (antes del canto)

Debajo: **tabla de despiece** con group headers por capa.

### Acciones individuales
- **Copiar** → copia el despiece al portapapeles como texto plano
- **Compartir** → Web Share API (fallback a copiar)
- **Imprimir** → `window.print()` con CSS de impresión
- **Guardar** → agrega el frente al historial

### Historial (unificado, plegable)
- Hasta **30 frentes** guardados (localStorage)
- **Filtros chips:** `Todos` · `Step` · `Media caña` · `Placar`
- Cada ítem muestra: medida FINAL + ×cantidad + tag de modelo + fecha + cliente
- Botón **Cargar** (restaura todos los datos del frente, incluyendo refilado específico)
- Botón **✕** (eliminar frente individual)
- Botón **Vaciar historial** (con confirmación)

### Impresión batch (desde historial)
Dos tipos de PDF separados:

**A) "Imprimir orden de corte"** — agrupa piezas por **operación** (Base 12mm / Base 18mm / Caras 9mm / Capa 2 vert / Capa 2 horiz / Capa 3 vert / Capa 3 horiz / Faja placar vert / Faja placar horiz)

**B) "Imprimir corte por medida"** — agrupa piezas por **ancho de corte de la tira** (ej. "Tiras 3mm × 7,2 cm (final 6,3 cm)"). Útil para el operario que configura la sierra en un ancho y corta todas las tiras de ese ancho juntas.

**Ambos PDFs** incluyen:
- Header MOBILI navy + cliente/orden/fecha
- **Índice de frentes arriba:** chips chiquitos en grid de 4 columnas con `#N · medida FINAL · ×cant` (para identificación visual rápida)
- Tablas con medidas de CORTE (que es lo que ejecuta el operario), con columna REF para rastrear a qué frente pertenece cada pieza
- Totales al pie
- Ambos usan overlay full-screen con iframe para evitar el bug de Android que imprime la app padre

### PWA
- Instalable (manifest + service worker con cache stale-while-revalidate)
- Ícono: cuadrado blanco marco sobre fondo navy MOBILI (como el logo real)
- Funciona offline después de la primera carga

---

## ESTRUCTURA DE ARCHIVOS DEL REPO

```
molduras-laqueado-mobili/
├── index.html              # UI principal con selector de modelo
├── app.js                  # Lógica de cálculo, historial, impresión
├── sw.js                   # Service worker (offline)
├── manifest.json           # Manifest PWA
├── icon.svg / icon-maskable.svg
├── icon-192.png / icon-512.png / icon-maskable-512.png
├── favicon.png
├── .nojekyll               # GitHub Pages sirve los archivos tal cual
├── .gitignore
├── README.md               # Uso, fórmulas y deploy
└── SPEC.md                 # Este documento (especificación de referencia)
```

Todas las rutas son relativas (`./`) para que funcione dentro de la subcarpeta de GitHub Pages.
