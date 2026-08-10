'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AdminSelect } from '@/components/ui/AdminSelect';
import { toast } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DEFAULT_FIELD_ROTATION,
  DEFAULT_LABEL_VISIBILITY,
  LABEL_CONTENT_MIN_MM,
  LABEL_FIELDS,
  LABEL_FIELD_ROTATIONS,
  LABEL_FOLD_LENGTH_MIN_MM,
  LABEL_FOLD_MIN_MM,
  LABEL_HEIGHT_MAX_MM,
  LABEL_HEIGHT_MIN_MM,
  LABEL_INK,
  LABEL_LENGTH_MAX_MM,
  LABEL_LENGTH_MIN_MM,
  LABEL_LEVELS,
  LABEL_ORIENTATIONS,
  LABEL_PAPER,
  labelFoldOptions,
  labelHeightOptions,
  labelLengthOptions,
  validateLabelSize,
  type LabelFieldKey,
  type LabelFieldRotation,
  type LabelLevel,
  type LabelOrientation,
  type LabelPlacements,
  type LabelShape,
  type LabelTemplate,
  type LabelTemplateInput,
  type LabelVisibility,
} from '@/lib/label/geometry';
import { layoutLabel, SAMPLE_CONTENT } from '@/lib/label/layout';
import { LabelTemplatePreview } from '@/components/label/LabelTemplatePreview';
import {
  createLabelTemplate,
  deleteLabelTemplate,
  labelTemplateUsage,
  listLabelTemplates,
  setDefaultLabelTemplate,
  updateLabelTemplate,
} from '@/app/(admin)/admin/labels/actions';

const fieldCls =
  'w-full px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
const labelCls = 'block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1';

function levelLabel(level: LabelLevel): string {
  return LABEL_LEVELS.find((l) => l.value === level)?.label ?? level;
}

/** Fields that were pinned rather than left to follow the template's direction. */
function overriddenFields(t: LabelTemplate): string[] {
  return LABEL_FIELDS.filter(({ key }) => (t.rotation?.[key] ?? 'auto') !== 'auto').map(
    ({ key, label }) => `${label.toLowerCase()} ${t.rotation[key]}`
  );
}

/**
 * Label sizes live here rather than on the variant screen: a template describes a
 * carton, so it is shared by every family that ships in that carton. Editing one
 * reaches all of them at once, which is the point — the supplier gets one set of
 * dimensions per packaging level instead of a size invented per product.
 */
export function LabelTemplatesManager({ labelLogoUrl }: { labelLogoUrl: string | null }) {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [rows, counts] = await Promise.all([listLabelTemplates(), labelTemplateUsage()]);
    setTemplates(rows);
    setUsage(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(input: LabelTemplateInput) {
    const result = await createLabelTemplate(input);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Template “${result.template.name}” created.`);
    setCreating(false);
    await refresh();
  }

  async function handleUpdate(id: string, input: LabelTemplateInput) {
    const result = await updateLabelTemplate(id, input);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    const families = usage[id] || 0;
    toast.success(
      families > 0
        ? `Saved. ${families} ${families === 1 ? 'family prints' : 'families print'} this size.`
        : 'Template saved.'
    );
    setEditingId(null);
    await refresh();
  }

  async function handleDelete(template: LabelTemplate) {
    const families = usage[template.id] || 0;
    const ok = await confirmDialog({
      title: `Delete “${template.name}”?`,
      message:
        families > 0
          ? `${families} ${families === 1 ? 'family prints' : 'families print'} this template. They will lose the choice and fall back to the default size. Labels already sent to a supplier are unaffected.`
          : 'No family uses this template, so nothing else changes.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    setBusyId(template.id);
    const result = await deleteLabelTemplate(template.id);
    setBusyId(null);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success('Template deleted.');
    await refresh();
  }

  async function handleMakeDefault(template: LabelTemplate) {
    setBusyId(template.id);
    const result = await setDefaultLabelTemplate(template.id);
    setBusyId(null);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`“${template.name}” is now the default.`);
    await refresh();
  }

  return (
    <section className="bg-white border border-gray-200 p-6 space-y-5">
      <div className="border-b border-gray-200 pb-3">
        <h2 className="text-lg font-medium uppercase tracking-wide">Label Templates</h2>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading templates…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-500 border border-gray-200 bg-gray-50 p-3">
          No templates yet. Add the first one below — the size measured from the artwork already in
          production is 130 × 50 mm with the fold {LABEL_FOLD_MIN_MM} mm from the left. Sizes can go
          down to {LABEL_LENGTH_MIN_MM} × {LABEL_HEIGHT_MIN_MM} mm.
        </p>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200">
          {templates.map((t) =>
            editingId === t.id ? (
              <div key={t.id} className="bg-gray-50 p-4">
                <TemplateFields
                  initial={t}
                  logoUrl={labelLogoUrl}
                  submitLabel="Save template"
                  onCancel={() => setEditingId(null)}
                  onSubmit={(input) => handleUpdate(t.id, input)}
                />
              </div>
            ) : (
              <div key={t.id} className="flex items-center gap-4 p-4">
                <div className="flex w-[92px] flex-shrink-0 justify-center">
                  <TemplateOutline
                    width_mm={t.width_mm}
                    height_mm={t.height_mm}
                    orientation={t.orientation}
                    sections={t.sections}
                    fold_mm={t.fold_mm}
                    background={t.background_color}
                    ink={t.ink_color}
                    maxPx={92}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">{t.name}</p>
                    {t.is_default && (
                      <span className="flex-shrink-0 border border-gray-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-900">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {levelLabel(t.level)} · {t.width_mm} × {t.height_mm} mm ·{' '}
                    {t.orientation === 'portrait' ? 'vertical art' : 'horizontal art'} ·{' '}
                    {t.sections === 2 ? `fold at ${t.fold_mm} mm` : 'single panel'}
                  </p>
                  {overriddenFields(t).length > 0 && (
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      Set on its own: {overriddenFields(t).join(', ')}
                    </p>
                  )}
                  {/* Worth knowing without opening it: a hand-arranged template
                      stops following the engine, so a change to the layout rules
                      reaches every other size but not this one. */}
                  {Object.keys(t.placements ?? {}).length > 0 && (
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      Arranged by hand — the engine no longer moves anything on this size.
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {usage[t.id]
                      ? `${usage[t.id]} ${usage[t.id] === 1 ? 'family' : 'families'} printing this`
                      : 'Not assigned to any family yet'}
                  </p>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1">
                  {!t.is_default && (
                    <button
                      type="button"
                      onClick={() => handleMakeDefault(t)}
                      disabled={busyId === t.id}
                      title="Make default"
                      className="p-2 text-gray-400 transition-colors hover:text-gray-900 disabled:opacity-40"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setEditingId(t.id);
                    }}
                    title="Edit"
                    className="p-2 text-gray-400 transition-colors hover:text-gray-900"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    disabled={busyId === t.id}
                    title="Delete"
                    className="p-2 text-gray-400 transition-colors hover:text-red-600 disabled:opacity-40"
                  >
                    {busyId === t.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {creating ? (
        <div className="border border-gray-200 bg-gray-50 p-4">
          <TemplateFields
            logoUrl={labelLogoUrl}
            submitLabel="Create template"
            onCancel={() => setCreating(false)}
            onSubmit={handleCreate}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setEditingId(null);
            setCreating(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New template
        </Button>
      )}
    </section>
  );
}

/**
 * Proportional outline of the label and the fold.
 *
 * Always drawn horizontally, like every other view of a label: the canvas does not
 * turn, so a set of templates can be compared down a list. Direction shows in the
 * `Aa`, which is turned when the artwork reads bottom-to-top.
 */
function TemplateOutline({
  width_mm,
  height_mm,
  orientation,
  sections,
  fold_mm,
  background = LABEL_INK,
  ink = LABEL_PAPER,
  maxPx,
}: {
  width_mm: number;
  height_mm: number;
  orientation: LabelOrientation;
  sections: 1 | 2;
  fold_mm: number | null;
  background?: string;
  ink?: string;
  maxPx: number;
}) {
  if (!(width_mm > 0) || !(height_mm > 0)) {
    return <div style={{ width: maxPx, height: maxPx / 2 }} />;
  }
  const scale = Math.min(maxPx / width_mm, maxPx / height_mm);
  const showFold = sections === 2 && fold_mm !== null && fold_mm > 0 && fold_mm < width_mm;
  const dash = width_mm / 40;
  const type = Math.min(width_mm, height_mm) / 4;
  const anchorX = (showFold ? (fold_mm as number) : 0) + type * 0.5;
  const anchorY = height_mm - type * 0.5;

  return (
    <svg
      width={width_mm * scale}
      height={height_mm * scale}
      viewBox={`0 0 ${width_mm} ${height_mm}`}
      aria-hidden="true"
    >
      <rect x={0} y={0} width={width_mm} height={height_mm} fill={background} />
      {showFold && (
        <line
          x1={fold_mm as number}
          y1={0}
          x2={fold_mm as number}
          y2={height_mm}
          stroke={ink}
          strokeWidth={Math.max(0.4, width_mm / 200)}
          strokeDasharray={`${dash} ${dash}`}
        />
      )}
      <text
        x={anchorX}
        y={anchorY}
        transform={orientation === 'portrait' ? `rotate(-90 ${anchorX} ${anchorY})` : undefined}
        fill={ink}
        opacity={0.6}
        fontSize={type}
        fontFamily="sans-serif"
      >
        Aa
      </text>
    </svg>
  );
}

function TemplateFields({
  initial,
  logoUrl,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: LabelTemplate;
  /** The label logo from Settings, so the preview shows the real wordmark. */
  logoUrl: string | null;
  submitLabel: string;
  onSubmit: (input: LabelTemplateInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [level, setLevel] = useState<LabelLevel>(initial?.level ?? 'product_box');
  const [orientation, setOrientation] = useState<LabelOrientation>(
    initial?.orientation ?? 'landscape'
  );
  // The canvas, as drawn and as exported: the long side across, always.
  // Held as text while typing so values like "121" can be entered freely —
  // clamping on every keystroke blocked intermediate digits (e.g. typing "1"
  // jumped back to the 15mm floor).
  const [lengthText, setLengthText] = useState(String(initial?.width_mm ?? 130));
  const [heightText, setHeightText] = useState(String(initial?.height_mm ?? 50));
  const [foldText, setFoldText] = useState(String(initial?.fold_mm ?? 30));
  const length = Number(lengthText);
  const height = Number(heightText);
  const fold = Number(foldText);
  const [sections, setSections] = useState<'1' | '2'>(initial?.sections === 1 ? '1' : '2');
  const [rotation, setRotation] = useState<Record<LabelFieldKey, LabelFieldRotation>>(
    initial?.rotation ?? DEFAULT_FIELD_ROTATION
  );
  const [visibility, setVisibility] = useState<LabelVisibility>(
    initial?.visibility ?? DEFAULT_LABEL_VISIBILITY
  );
  const [backgroundColor, setBackgroundColor] = useState(
    initial?.background_color ?? LABEL_INK
  );
  const [inkColor, setInkColor] = useState(initial?.ink_color ?? LABEL_PAPER);
  const [placements, setPlacements] = useState<LabelPlacements>(initial?.placements ?? {});
  const [busy, setBusy] = useState(false);

  const foldOptions = Number.isFinite(length) ? labelFoldOptions(length) : [];
  const canFold = foldOptions.length > 0;
  const twoUp = sections === '2' && canFold;

  // Shortening the label can strand the fold outside its range, or leave no room
  // to fold at all. Both are corrected here so the form never holds a size the
  // frame would reject — the alternative is a save button that refuses to work
  // without saying which field is at fault.
  useEffect(() => {
    if (!canFold) {
      setSections('1');
      return;
    }
    if (Number.isFinite(fold) && !foldOptions.includes(fold)) {
      setFoldText(String(foldOptions[foldOptions.length - 1]));
    }
  }, [canFold, fold, foldOptions]);

  // Kept apart from the name and the level, and memoised, because this is what the
  // engine reads: typing a name should not re-run the layout, and the preview
  // should not redraw for it either.
  // A hand-arranged block does not follow the trim when the trim shrinks, so a
  // label taken from 130 to 60mm would keep artwork off the edge and refuse to
  // save. Pulling everything back inside the new canvas keeps the arrangement as
  // close to where it was put as the size allows.
  useEffect(() => {
    if (!Number.isFinite(length) || !Number.isFinite(height) || length <= 0 || height <= 0) {
      return;
    }
    setPlacements((current) => {
      const keys = Object.keys(current) as LabelFieldKey[];
      if (keys.length === 0) return current;
      let moved = false;
      const next: LabelPlacements = {};
      for (const key of keys) {
        const box = current[key];
        if (!box) continue;
        const w = Math.min(box.w, length);
        const h = Math.min(box.h, height);
        const inside = {
          // The turn comes along: a block pulled back inside a smaller label is the
          // same block, still facing the way it was turned to face.
          ...box,
          x: Math.min(Math.max(box.x, 0), Math.max(0, length - w)),
          y: Math.min(Math.max(box.y, 0), Math.max(0, height - h)),
          w,
          h,
        };
        if (inside.x !== box.x || inside.y !== box.y || w !== box.w || h !== box.h) moved = true;
        next[key] = inside;
      }
      return moved ? next : current;
    });
  }, [length, height]);

  const shape = useMemo<LabelShape>(
    () => ({
      width_mm: Number.isFinite(length) ? length : 0,
      height_mm: Number.isFinite(height) ? height : 0,
      orientation,
      sections: twoUp ? 2 : 1,
      fold_mm: twoUp && Number.isFinite(fold) ? fold : null,
      rotation,
      placements,
      background_color: backgroundColor,
      ink_color: inkColor,
      visibility,
    }),
    [length, height, orientation, twoUp, fold, rotation, placements, backgroundColor, inkColor, visibility]
  );

  const draft: LabelTemplateInput = {
    name,
    level,
    brand: initial?.brand || 'Luken',
    width_mm: Number.isFinite(length) ? length : 0,
    height_mm: Number.isFinite(height) ? height : 0,
    orientation,
    sections: twoUp ? 2 : 1,
    fold_mm: twoUp && Number.isFinite(fold) ? fold : null,
    rotation,
    placements,
    background_color: backgroundColor,
    ink_color: inkColor,
    visibility,
  };

  const sizeError = validateLabelSize(draft);

  // What this size actually yields. Shown because the interesting part of a size
  // is not its dimensions, it is how large the type and the symbols come out, and
  // whether a direction the fields were pinned to survived the space available.
  const summary = useMemo(() => {
    if (sizeError) return null;
    const l = layoutLabel(shape, {
      ...SAMPLE_CONTENT,
      barcode: level !== 'product' && visibility.barcode,
      qr: visibility.qr && SAMPLE_CONTENT.qr,
      logo: visibility.logo,
      site: visibility.site,
      family: visibility.text ? SAMPLE_CONTENT.family : '',
      name: visibility.text ? SAMPLE_CONTENT.name : '',
      code: visibility.text ? SAMPLE_CONTENT.code : '',
      spec: visibility.text ? SAMPLE_CONTENT.spec : '',
    });
    return {
      lines: new Set(l.lines.map((x) => x.key)).size,
      step: l.step,
      qr: l.qr?.w ?? 0,
      bars: l.barcode?.barHeight ?? 0,
      family: l.lines.find((x) => x.key === 'family')?.size ?? 0,
      dropped: l.dropped,
      notes: l.notes,
    };
  }, [sizeError, level, shape, visibility]);

  async function handleSubmit() {
    setBusy(true);
    // The parent closes the form on success and reports the error otherwise, so
    // a rejected size keeps the typed values on screen to be corrected.
    await onSubmit(draft);
    setBusy(false);
  }

  /** Digits only while typing; empty is allowed so the field can be rewritten. */
  function onMmChange(raw: string, setText: (v: string) => void) {
    if (raw === '') {
      setText('');
      return;
    }
    if (!/^\d+(\.\d*)?$/.test(raw)) return;
    setText(raw);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <div className="col-span-2">
          <label className={labelCls}>Name</label>
          <input
            className={fieldCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product Box 130x50"
          />
        </div>
        <div>
          <label className={labelCls}>Level</label>
          <AdminSelect
            aria-label="Packaging level"
            value={level}
            onChange={(v) => setLevel(v as LabelLevel)}
            options={LABEL_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
          />
        </div>
        <div>
          <label className={labelCls}>Width (mm)</label>
          <input
            className={fieldCls}
            type="text"
            inputMode="decimal"
            value={lengthText}
            onChange={(e) => onMmChange(e.target.value, setLengthText)}
            placeholder={`${LABEL_LENGTH_MIN_MM}–${LABEL_LENGTH_MAX_MM}`}
            list="label-width-presets"
          />
          <datalist id="label-width-presets">
            {labelLengthOptions().map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelCls}>Height (mm)</label>
          <input
            className={fieldCls}
            type="text"
            inputMode="decimal"
            value={heightText}
            onChange={(e) => onMmChange(e.target.value, setHeightText)}
            placeholder={`${LABEL_HEIGHT_MIN_MM}–${LABEL_HEIGHT_MAX_MM}`}
            list="label-height-presets"
          />
          <datalist id="label-height-presets">
            {labelHeightOptions().map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelCls}>Sections</label>
          <AdminSelect
            aria-label="Sections"
            value={twoUp ? '2' : '1'}
            onChange={(v) => setSections(v === '2' ? '2' : '1')}
            options={
              canFold
                ? [
                    { value: '1', label: '1 — plain' },
                    { value: '2', label: '2 — with fold' },
                  ]
                : [{ value: '1', label: '1 — plain' }]
            }
          />
          {!canFold && (
            <p className="mt-1 text-[11px] text-gray-500">
              A fold needs {LABEL_FOLD_LENGTH_MIN_MM} mm of length: {LABEL_FOLD_MIN_MM} mm for the
              barcode panel plus {LABEL_CONTENT_MIN_MM} mm for the main panel.
            </p>
          )}
        </div>
        <div className="col-span-2 md:col-span-3">
          <label className={labelCls}>Artwork direction</label>
          <AdminSelect
            aria-label="Artwork direction"
            value={orientation}
            onChange={(v) => setOrientation(v === 'portrait' ? 'portrait' : 'landscape')}
            options={LABEL_ORIENTATIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
        {twoUp && (
          <div>
            <label className={labelCls}>Fold at (mm)</label>
            <input
              className={fieldCls}
              type="text"
              inputMode="decimal"
              value={foldText}
              onChange={(e) => onMmChange(e.target.value, setFoldText)}
              placeholder={`${LABEL_FOLD_MIN_MM}+`}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className={labelCls}>Background</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Background colour"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value.toUpperCase())}
              className="h-9 w-12 cursor-pointer border border-gray-300 bg-white p-0.5"
            />
            <input
              className={fieldCls}
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value.toUpperCase())}
              spellCheck={false}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Text / logo</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Ink colour"
              value={inkColor}
              onChange={(e) => setInkColor(e.target.value.toUpperCase())}
              className="h-9 w-12 cursor-pointer border border-gray-300 bg-white p-0.5"
            />
            <input
              className={fieldCls}
              value={inkColor}
              onChange={(e) => setInkColor(e.target.value.toUpperCase())}
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      <div className="border border-gray-200 bg-white p-3">
        <p className="text-xs font-medium text-gray-700">Content on this label</p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Turn off anything this die should not print. Barcode and QR stay dark-on-white for scanning.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {LABEL_FIELDS.map((field) => (
            <label key={field.key} className="inline-flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={visibility[field.key]}
                onChange={(e) =>
                  setVisibility((prev) => ({ ...prev, [field.key]: e.target.checked }))
                }
                className="h-4 w-4 rounded-none border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              {field.label}
            </label>
          ))}
        </div>
      </div>

      {/* Per-field direction. Most labels never need this, so it stays compact and
          out of the way, but it is the only way to keep a barcode reading across a
          label whose text runs up — mixing the two is a normal packaging need. */}
      <div className="border border-gray-200 bg-white p-3">
        <p className="text-xs font-medium text-gray-700">Direction of each field</p>
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-5">
          {LABEL_FIELDS.map((field) => (
            <div key={field.key}>
              <label className={labelCls}>{field.label}</label>
              <AdminSelect
                aria-label={`${field.label} direction`}
                value={rotation[field.key] ?? 'auto'}
                onChange={(v) =>
                  setRotation((prev) => ({ ...prev, [field.key]: v as LabelFieldRotation }))
                }
                options={LABEL_FIELD_ROTATIONS.map((r) => ({ value: r.value, label: r.label }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* The artwork, not a diagram of it. Every control above redraws it, which is
          the only way to choose a size by looking rather than by imagining. */}
      {sizeError ? (
        <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-[11px] text-amber-800">{sizeError}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <LabelTemplatePreview
            shape={shape}
            level={level}
            logoUrl={logoUrl}
            onPlacements={setPlacements}
          />
          {summary && (
            <div className="border border-gray-200 bg-white p-3">
              <p className="text-[11px] text-gray-700">
                Carries everything: {summary.lines} lines of text, QR at {summary.qr} mm
                {summary.bars > 0
                  ? `, barcode bars ${summary.bars.toFixed(1)} mm`
                  : ', no barcode at this level'}
                .
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Family name at {summary.family.toFixed(1)} mm — {Math.round(summary.step * 100)}% of
                the size used on the 130 × 50 artwork.
              </p>
              {summary.dropped.map((d) => (
                <p key={d.key} className="mt-1 text-[11px] text-red-700">
                  {d.reason}
                </p>
              ))}
              {summary.notes.map((n) => (
                <p key={n} className="mt-1 text-[11px] text-amber-700">
                  {n}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={handleSubmit} disabled={busy || Boolean(sizeError)}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              {submitLabel}
            </>
          )}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={busy}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
