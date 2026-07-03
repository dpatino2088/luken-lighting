import {
  FileText,
  FileSpreadsheet,
  BookOpen,
  Ruler,
  Box,
  Download,
} from 'lucide-react';

/* Shared display constants for the product / variant public views. Kept in a
   non-page module so they can be imported by both page.tsx and VariantView.tsx
   (Next.js forbids arbitrary named exports from route `page` files). */

export const CONTROL_LABELS: Record<string, string> = {
  'on-off': 'On/Off',
  phase: 'Phase Cut',
  dali: 'DALI',
  '0-10v': '0-10V',
  '1-10v': '1-10V',
  casambi: 'Casambi',
  zigbee: 'Zigbee',
  dmx: 'DMX512',
  push: 'Push-dim',
};

export const IMAGE_ASSET_TYPES = new Set([
  'image',
  'installed_image',
  'dimensions_image',
  'photometric_image',
]);

export const ASSET_TYPE_LABELS: Record<string, string> = {
  datasheet: 'Datasheet',
  photometric: 'Photometric Data',
  photometric_image: 'Photometric Curve',
  installed_image: 'Installed',
  dimensions_image: 'Dimensions',
  manual: 'Installation Manual',
  catalogue: 'Catalogue',
  line_drawing: 'Line Drawing',
  revit: 'Revit Model',
  '3d': '3D Model',
  other: 'Document',
};

export const ASSET_TYPE_ICONS: Record<string, typeof FileText> = {
  datasheet: FileText,
  photometric: FileSpreadsheet,
  manual: BookOpen,
  line_drawing: Ruler,
  catalogue: BookOpen,
  revit: Box,
  '3d': Box,
  other: Download,
};
