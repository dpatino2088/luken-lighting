# Optimización de imágenes — tareas pendientes para Cursor

## Contexto

Stack: Next.js 14 (App Router) + Supabase Storage. Las subidas de imágenes van
directo del navegador a Supabase Storage (no pasan por el servidor de
Next.js). `next.config.js` ya tiene `images.remotePatterns` configurado para
`**.supabase.co/storage/v1/object/public/**`, así que `next/image` funciona
sin cambios de config adicionales.

## Ya implementado (no repetir)

Se creó `lib/utils/compressImage.ts`: redimensiona (canvas, máx. dimensión
configurable) y reconvierte a WebP en el navegador *antes* de subir a
Storage. Si falla o no reduce el tamaño, sube el archivo original sin tocar.
No procesa SVG ni GIF.

Ya integrado en los 4 puntos de subida:
- `components/admin/FileUploadSection.tsx` (solo tipos de imagen de
  producto: `image`, `installed_image`, `dimensions_image`,
  `photometric_image`; PDFs/IES/Revit/3D quedan intactos) — 2400px, calidad 0.85
- `components/admin/EntityImageCard.tsx` — hero 2400px, thumbnail 800px
- `components/admin/ProjectEditPage.tsx` (galería inspiración) — 2400px
- `components/admin/SiteImageCard.tsx` — 2400px

## Pendiente

### 1. Reemplazar `<img>` por `next/image` en el sitio público
24 archivos usan `<img>` en vez de `next/image`, incluidos los del sitio
público (no solo el admin):
- `app/(public)/page.tsx`
- `app/(public)/products/page.tsx`
- `app/(public)/products/[slug]/page.tsx` y `VariantView.tsx`
- `app/(public)/inspiration/page.tsx` y `[slug]/page.tsx`
- `app/(public)/about/page.tsx`, `professionals/page.tsx`
- `components/ProductCard.tsx`, `SiteHeader.tsx`

`next/image` da lazy loading, `srcset` responsive y compresión adicional
automática sin más configuración (el `remotePatterns` ya está listo). Los
componentes admin (`EntityImageCard`, `SiteImageCard`, etc.) pueden quedar
con `<img>` tal cual — son de bajo tráfico y no vale la pena el esfuerzo ahí.

Al migrar, usar contenedores con `position: relative` + `fill` (los
`aspect-video` / `aspect-[4/3]` que ya existen en varios componentes sirven
de referencia) o `width`/`height` explícitos cuando se conozcan.

### 2. Cache-Control en las subidas a Storage
Las 4 subidas de imagen (`FileUploadSection`, `EntityImageCard`,
`ProjectEditPage`, `SiteImageCard`) no pasan `cacheControl` en
`.upload(path, file, { upsert: true })`. Como todos los paths incluyen
`Date.now()` o un UUID (son inmutables por path), es seguro cachear
agresivo:

```ts
.upload(filePath, uploadFile, { upsert: true, cacheControl: '31536000' }) // 1 año
```

### 3. Límite de tamaño de archivo en el input
Ningún input de archivo valida tamaño antes de subir (útil para fotos de
cámara/dron de +20MB). Agregar un chequeo simple antes de llamar a
`compressImage`/`upload`, por ejemplo rechazar >15MB con un `toast.error`
explicando el límite.

### 4. (Opcional, evaluar plan de Supabase) Image Transformation API
Si el plan de Supabase lo soporta, servir tamaños distintos (thumb/medium/
full) desde un único archivo almacenado vía el endpoint de transformación,
en vez de generar y subir variantes por separado. Revisar
https://supabase.com/docs/guides/storage/serving/image-transformations
antes de invertir tiempo aquí — requiere plan Pro o superior.
