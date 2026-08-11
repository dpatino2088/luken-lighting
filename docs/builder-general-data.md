# Builder → General Data — Campos y respuestas posibles

Listado completo de lo que pregunta el Builder en la pestaña **General Data**, con las
respuestas posibles de cada campo. Los códigos entre paréntesis son los que se escriben
en el SKU.

Convenciones:

- **Lista** → se elige de un desplegable.
- **Ingresar valor** → campo libre que se escribe a mano.
- **Automático** → lo calcula el sistema, no se carga.

---

## 0. Type (define qué campos aparecen)

Este es el primer campo y condiciona todo lo demás. Según lo que se elija, el Builder
muestra cuatro conjuntos de preguntas distintos.

**Lista (21 opciones):**

Downlights · Spotlights · Wall / Ceiling · Suspension · General Lighting · Lineal Light ·
Track Line Voltage · Track Low Voltage · Systems · LED Profiles · LED Strips ·
Landscape / Outdoor · In-Ground · Pole Mounted · Table / Floor · Emergency · Fans ·
LED Bulbs & Modules · Power & Control · Tool · Accessories

**Los cuatro modos que se activan:**

| Type elegido | Modo | Qué cambia |
|---|---|---|
| Cualquiera no listado abajo | Luminaria estándar | Pregunta todo: formato, forma, acabado y fuente de luz |
| Track Line Voltage · Track Low Voltage | Track | Sin fuente de luz. Pide sistema de riel y largo |
| LED Profiles | Perfiles | Sin fuente de luz. Pide difusor/perfil y largo |
| Accessories | Accesorios | Solo tipo de accesorio, color y versión |

---

## 1. Identity & format

### Modo luminaria estándar

| # | Pregunta | Tipo | Respuestas posibles |
|---|---|---|---|
| 1 | Series *(obligatorio)* | Ingresar valor | Texto en mayúsculas, ej. `SAN`, `ORI`, `MAI` |
| 2 | Size / format | Lista | MR16 · MR11 · A19 · A21 · PAR16 · PAR20 · PAR30 · PAR38 · BR30 · BR40 · T8 · T5 · Custom |
| 3 | Custom text *(solo si Size = Custom)* | Ingresar valor | Ej. `35x50`, `Mini`, `XL`, `35` |
| 4 | Shape | Lista | R – Round · S – Square · L – Linear · RT – Rectangular |
| 5 | Length (mm) *(solo si Shape = Linear)* | Ingresar valor | Número en mm, ej. `1200` |
| 6 | Mounting type | Lista | ver **Mounting type** abajo |
| 7 | Trim | Lista | TRM – Trimmed · TRL – Trimless |
| 8 | Color / finish | Lista | ver **Color / finish** abajo |
| 9 | Custom color / finish *(solo si Color = Custom)* | Ingresar valor | Ej. `RAL 9016`, `Brushed copper` |

### Modo Track

| # | Pregunta | Tipo | Respuestas posibles |
|---|---|---|---|
| 1 | Series *(obligatorio)* | Ingresar valor | Texto en mayúsculas |
| 2 | Track system | Lista | Si Type = **Track Line Voltage**: 1PH – Single-circuit · 3PH – Three-circuit<br>Si Type = **Track Low Voltage**: MAG48 – 48V Magnetic · MAG24 – 24V Magnetic · LV – Low-voltage |
| 3 | Length (mm) | Ingresar valor | Solo números. `1000` = 1 m, `2000` = 2 m |
| 4 | Mounting type | Lista | ver **Mounting type** abajo |
| 5 | Trim | Lista | TRM – Trimmed · TRL – Trimless |
| 6 | Color / finish | Lista | ver **Color / finish** abajo |
| 7 | Custom color / finish *(solo si Color = Custom)* | Ingresar valor | Ej. `RAL 9016`, `Brushed copper` |
| 8 | Version | Lista | V2 · V3 · V4 · Custom |
| 9 | Custom version *(solo si Version = Custom)* | Ingresar valor | Ej. `V5`, `Rev A` |

### Modo LED Profiles

| # | Pregunta | Tipo | Respuestas posibles |
|---|---|---|---|
| 1 | Series *(obligatorio)* | Ingresar valor | Texto en mayúsculas |
| 2 | Diffuser / Profile | Lista | DIFF – Diffuser · PRF – Profile |
| 3 | Length (mm) | Ingresar valor | Solo números. `1000` = 1 m |
| 4 | Profile type | Lista | SUR – Surface · REC – Recessed · PEN – Suspended / Pendant · COR – Corner · TRL – Trimless |
| 5 | Trim | Lista | TRM – Trimmed · TRL – Trimless |
| 6 | Color / finish | Lista | ver **Color / finish** abajo |
| 7 | Custom color / finish *(solo si Color = Custom)* | Ingresar valor | Ej. `RAL 9016`, `Brushed copper` |
| 8 | Version | Lista | V2 · V3 · V4 · Custom |
| 9 | Custom version *(solo si Version = Custom)* | Ingresar valor | Ej. `V5`, `Rev A` |

En este modo **no se pregunta Mounting type**: el montaje queda representado por el
Profile type (SUR / REC / PEN…).

### Modo Accessories

| # | Pregunta | Tipo | Respuestas posibles |
|---|---|---|---|
| 1 | Series *(obligatorio)* | Ingresar valor | Encabeza el SKU: `ORI-ACC-CLIP-WH` |
| 2 | Accessory type | Lista | CLIP – Clip · ADAPT – Adapter · CABLE – Cable · FEED – Feed · CONN – Connector · BRKT – Bracket · COVER – Cover · ENDC – End cap · JOIN – Joiner · SUSP – Suspension kit · Custom |
| 3 | Custom accessory type *(solo si Custom)* | Ingresar valor | Ej. `Clip`, `Adapter`, `Feed` |
| 4 | Color / finish | Lista | ver **Color / finish** abajo |
| 5 | Custom color / finish *(solo si Color = Custom)* | Ingresar valor | Ej. `RAL 9016`, `Brushed copper` |
| 6 | Version | Lista | V2 · V3 · V4 · Custom |
| 7 | Custom version *(solo si Version = Custom)* | Ingresar valor | Ej. `V5`, `Rev A` |

---

## 2. Light source

Solo en modo luminaria estándar. CRI, CCT, Optic / beam y Power alimentan automáticamente
la Technical data de la ficha (Color temperature, CRI, Beam angle, System wattage), así que
no se cargan dos veces.

| # | Pregunta | Tipo | Respuestas posibles |
|---|---|---|---|
| 1 | Source *(obligatorio)* | Lista | LED · LST – LED strip · HAL – Halogen · RTF – Retrofit · MOD – Module |
| 2 | Socket | Lista | MOD – Integrated module · GU10 · GU5.3 (MR16) · E26 · E27 · G13 (T8) · G5 (T5) · Custom |
| 3 | Custom socket *(solo si Socket = Custom)* | Ingresar valor | Ej. `GX53`, `R7s` |
| 4 | Lumen (lm) | Ingresar valor | Número, ej. `1200`. **No entra en el SKU**, se muestra en General data y en la descripción |
| 5 | CRI | Lista | CR80 – CRI 80+ · CR90 – CRI 90+ · CR95 – CRI 95+ · CR100 – CRI 100 · Custom |
| 6 | Custom CRI *(solo si CRI = Custom)* | Ingresar valor | Número 0 a 100, ej. `97` |
| 7 | CCT | Lista | CT22 – 2200K warm amber · CT27 – 2700K warm white · CT30 – 3000K soft white · CT35 – 3500K neutral · CT40 – 4000K cool white · CT50 – 5000K daylight · CTUN – Tunable white · Custom |
| 8 | Custom CCT (K) *(solo si CCT = Custom)* | Ingresar valor | Un valor `3300`, o un rango `2700-6500` (el rango se guarda como tunable) |
| 9 | Optic / beam | Lista | OP10 – 10° · OP15 – 15° · OP24 – 24° · OP25 – 25° · OP36 – 36° · OP50 – 50° · OP60 – 60° · OP90 – 90° · OP112 – 112° · Custom |
| 10 | Custom beam angle (°) *(solo si Optic = Custom)* | Ingresar valor | Número 1 a 360, ej. `11` |
| 11 | Power | Lista | WT3 – 3W · WT4 – 4W · WT6 – 6W · WT7 – 7W · WT9 – 9W · WT10 – 10W · WT12 – 12W · WT13 – 13W · WT15 – 15W · WT20 – 20W · WT30 – 30W · WT35 – 35W · WT50 – 50W · Custom |
| 12 | Custom power (W) *(solo si Power = Custom)* | Ingresar valor | Número con decimal, ej. `18`, `4.5` |

---

## 3. Electrical & control

En todos los modos **menos** Accessories.

| # | Pregunta | Tipo | Respuestas posibles |
|---|---|---|---|
| 1 | Driver | Lista | INT – Integrated · EXT – External · RMCC – Remote constant current · RMCV – Remote constant voltage |
| 2 | CC / CV | Lista | **CV:** 12V · 15V · 18V · 24V · 36V · 48V DC · 32V AC<br>**CC:** 160mA · 180mA · 200mA · 250mA · 300mA · 350mA · 400mA · 450mA · 500mA · 550mA · 600mA · 700mA · 750mA · 800mA · 850mA · 900mA · 1000mA<br>Custom |
| 3 | Custom CC / CV *(solo si Custom)* | Ingresar valor | Ej. `48V DC`, `1400mA` |
| 4 | Enter voltage | Lista | 120V · 220V · 240V · 277V · 120/240V · 120/277V AC |
| 5 | Dimming / control | Lista | ND – Non-dimmable · PHD – Phase · 010 – 0–10V · 110 – 1–10V · DALI · DMX · RFD – RF · CAS – Casambi · ZIG – Zigbee · PUSH – Push · DNI – Driver not included |
| 6 | Version | Lista | V2 · V3 · V4 · Custom — *solo en modo luminaria estándar; en Track y Profiles se pregunta en Identity* |
| 7 | Custom version *(solo si Version = Custom)* | Ingresar valor | Ej. `V5`, `Rev A` |

---

## 4. Characteristics

El cuerpo de la pieza. El nombre del producto no se pregunta acá: lo pone el selector
de familia arriba del Builder, y de ahí sale la serie del SKU (`Draco` → `DRA`).

| # | Pregunta | Tipo | Respuestas posibles |
|---|---|---|---|
| 1 | IP rating | Lista | IP20 · IP44 · IP54 · IP65 · IP67 · IP68 — también encabeza las **Certifications** de la ficha |
| 2 | Electrical class | Lista | Class I · Class II · Class III |
| 3 | Material | Lista | Aluminum · Steel · Stainless steel · Metal · Plastic · Polycarbonate · Brass · Copper · Bronze · Zinc alloy · Glass · Wood · Ceramic |
| 4 | Width (mm) | Ingresar valor | Número en mm |
| 5 | Height (mm) | Ingresar valor | Número en mm |
| 6 | Depth (mm) | Ingresar valor | Número en mm |
| 7 | Weight (kg) | Ingresar valor | Número en kg |

---

## Listas compartidas

### Mounting type

14 opciones, se usan en modo luminaria estándar y en modo Track. El código entre
paréntesis es el que va al SKU.

Recessed (REC) · Surface mounted (SUR) · Suspended / Pendant (PEN) · Ceiling mounted (CEI) ·
Wall mounted (WAL) · Track mounted (TRA) · In-ground / In-grade (ING) · Floor standing (FLO) ·
Table / Desk (TAB) · Portable (POR) · Bollard / Post (BOL) · Pole mounted (POL) ·
Step / Stair (STE) · Underwater (UND)

### Color / finish

14 acabados de lista, más Custom.

**Un solo color:**
WH – White · BK – Black · BZ – Bronze · GD – Gold · CH – Chrome · SN – Satin Nickel · GR – Gray

**Metálico / crudo:**
ANZ – Anodizado · MF – Mill finish · MET – Metal

**Dos tonos (marco / difusor):**
WH/BK – White trim · Black diffuser
BK/WH – Black trim · White diffuser
BZ/WH – Bronze trim · White diffuser
GD/WH – Gold trim · White diffuser

**Custom:**
Abre el campo *Custom color / finish*, de texto libre (ej. `RAL 9016`, `Brushed copper`).
El SKU toma solo sus letras y dígitos, hasta 10 caracteres (`RAL 9016` → `RAL9016`),
porque el código se lee separando por guiones. La descripción, la ficha técnica y el
campo Finish de la variante guardan el texto tal como se escribió.

---

## Qué campos entran en cada SKU

El Builder arma dos códigos. Los segmentos van en el mismo orden en que se preguntan
en el formulario, así que el código se puede leer contra el cuestionario de arriba.

**Short SKU** — Series, Size + Shape, Track / Profile + largo, Mounting type, Trim,
Color, Source, Socket (sólo si es un casquillo real: GU10, E27… `MOD` no entra
porque el módulo integrado ya lo dice el Source), CCT y Optic / beam.

**Long SKU** — todo lo anterior más `MOD` cuando corresponde, CRI, Power, Driver,
CC / CV, Enter voltage, Dimming / control y Version, en el orden del cuestionario. El
corto ya no es un prefijo del largo: el CRI queda entre el socket y el CCT.

**Fuera del SKU** — Lumen, IP rating, Electrical class, Material y las dimensiones.
Se muestran en la ficha técnica y en la descripción. El Lumen se lee de los datos
técnicos (System / Source lumens), pero en la descripción aparece donde lo pide el
cuestionario: después del Socket y antes del CRI. El IP además se imprime como
primera certificación de la ficha, y en la pestaña **Notes** se agregan las demás
(CE, RoHS, ETL…) separadas por comas.

Ejemplo real:

```
Short SKU   MAI-35R-REC-TRM-WH-LED-CT30-OP24
Long SKU    MAI-35R-REC-TRM-WH-LED-MOD-CR90-CT30-OP24-WT6-EXT
Descripción 35 Round / Recessed / Trimmed / White / LED / integrated module /
            268 lm / CRI 90+ / 3000K soft white / 24° beam / 6W /
            External driver / Aluminum / IP20
```

---

## Cuando cambian las reglas

Nombre, código y las dos descripciones se generan acá pero se **guardan** en la
variante, para poder listar y buscar el catálogo sin rearmar nada. Esa copia queda
vieja apenas se cambia una regla.

Para que eso no dependa de que alguien recuerde re-guardar variante por variante,
cada fila lleva la build de reglas que la escribió (`sku_rules_version`) y la
página de Variants compara contra `SKU_RULES_VERSION` al cargar: si hay filas
atrasadas, las reescribe y vuelve a exportar los PDF afectados. Cuesta un conteo
cuando no hay nada que hacer.

**Al cambiar una regla que altere un valor generado, subí `SKU_RULES_VERSION` en
`lib/sku/skuRules.ts` en el mismo cambio.** Sin eso el catálogo no se entera.

El botón **Rebuild SKUs** hace lo mismo a pedido, mostrando antes la lista de qué
cambiaría; sirve para revisar, o para las filas que el pase automático salteó
porque dos variantes quedarían con el mismo Long SKU.

---

## Duplicar una variante

Una copia tiene que diferenciarse de su origen en algún lado, y el único lugar que
aguanta es el SKU. Al duplicar, la copia recibe `Version = COPY` (o `COPY2`,
`COPY3`… si ya existe), así que **genera** el código que tiene guardado en vez de
llevar un `-COPY` pegado por fuera. Eso es lo que la hace editable: si el sufijo
vive fuera del SKU, cada Save vuelve a derivar el código del origen y choca.

Como Version también entra en el Name y en el Short SKU, la copia se reconoce en la
lista: `Draco Point 70R TRM WH LED COPY`.

**La marca se cae sola.** Cambiás lo que la diferencia —otra óptica, otro CCT, otro
acabado— y guardás: si el código sin `COPY` ya no lo usa nadie, el guardado la
quita y escribe nombre, código y descripciones como si la variante se hubiera
creado así. No hay que apretar nada. Mientras la copia siga siendo idéntica al
origen la marca queda, porque es lo único que la mantiene única, y el guardado
avisa qué segmento falta cambiar.

Si la copia nunca estuvo activa, al caerse la marca también se rehace su URL, así
no arrastra un `-copy` para siempre. Una variante ya publicada conserva su slug.

Las copias hechas antes de esto quedaron con el `-COPY` por fuera y no se podían
guardar; el rebuild las vuelve a marcar en el SKU y les conserva el código, así que
la URL que ya tenían sigue sirviendo.
