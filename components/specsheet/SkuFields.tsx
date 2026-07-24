'use client';

import {
  type SkuState,
  type SkuOption,
  buildSku,
  DIM_OPTIONS,
  SHAPE_OPTIONS,
  ACCESSORY_TYPE_OPTIONS,
  TRACK_OPTIONS,
  PROFILE_OPTIONS,
  SOURCE_OPTIONS,
  SOCKET_OPTIONS,
  TRIM_OPTIONS,
  COLOR_OPTIONS,
  CRI_OPTIONS,
  CCT_OPTIONS,
  OPTIC_OPTIONS,
  WATTS_OPTIONS,
  DRIVER_OPTIONS,
  DRIVER_V_OPTIONS,
  CTRL_OPTIONS,
  VERSION_OPTIONS,
} from '@/lib/sku/skuRules';
import { MONTAJE_OPTIONS } from '@/lib/sku/specSheet';

const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
const inputClass = selectClass;
const labelClass = 'block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5';

function groupOptions(options: SkuOption[]): { group: string | null; items: SkuOption[] }[] {
  const out: { group: string | null; items: SkuOption[] }[] = [];
  for (const opt of options) {
    const g = opt.group ?? null;
    let bucket = out.find((b) => b.group === g);
    if (!bucket) {
      bucket = { group: g, items: [] };
      out.push(bucket);
    }
    bucket.items.push(opt);
  }
  return out;
}

function SkuSelect({
  label,
  value,
  onChange,
  options,
  placeholder = '— choose —',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SkuOption[];
  placeholder?: string;
}) {
  const grouped = groupOptions(options);
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">{placeholder}</option>
        {grouped.map((b, i) =>
          b.group ? (
            <optgroup key={i} label={b.group}>
              {b.items.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : (
            b.items.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          ),
        )}
      </select>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 bg-gray-50/40 p-5 sm:p-6 space-y-5">
      <div className="flex items-baseline gap-2 border-b border-gray-200 pb-3">
        <h4 className="text-sm font-semibold uppercase tracking-widest text-gray-800">{title}</h4>
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">{children}</div>
    </div>
  );
}

export function SkuFields({
  state,
  onChange,
  lumen,
  onLumenChange,
  /** Driven by Type = Accessories (not by Shape). */
  accessoryMode = false,
}: {
  state: SkuState;
  onChange: (s: SkuState) => void;
  lumen?: string;
  onLumenChange?: (v: string) => void;
  accessoryMode?: boolean;
}) {
  const set = (patch: Partial<SkuState>) => onChange({ ...state, ...patch });
  const r = buildSku(state);

  // Track / Profile / Linear shape are mutually exclusive.
  const chooseTrack = (v: string) =>
    set(v ? { track: v, profile: '', shape: state.shape === 'L' ? '' : state.shape, length: '' } : { track: '' });
  const chooseProfile = (v: string) =>
    set(v ? { profile: v, track: '', shape: state.shape === 'L' ? '' : state.shape, length: '' } : { profile: '' });
  const chooseShape = (v: string) =>
    set(v === 'L' ? { shape: v, track: '', profile: '' } : { shape: v });

  // Shape dropdown is geometry only (R/S/L/RT). Never show ACC here.
  const shapeValue = state.shape === 'ACC' ? '' : state.shape;

  return (
    <div className="space-y-8">
      <div className="bg-gray-900 text-white p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">Short SKU</div>
          <div className="font-mono text-sm break-all">{r.shortCode || '—'}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">Long SKU</div>
          <div className="font-mono text-xs break-all text-gray-300">{r.longCode || '—'}</div>
        </div>
      </div>

      <Section
        title="Identity & format"
        hint={accessoryMode ? 'Type Accessories → SKU is SERIES-ACC-TYPE-…' : undefined}
      >
        <div>
          <label className={labelClass}>Series (required)</label>
          <input
            className={inputClass}
            value={state.series}
            onChange={(e) => set({ series: e.target.value.toUpperCase() })}
            placeholder="e.g. SAN, ORI"
          />
          {accessoryMode && (
            <p className="mt-1 text-[11px] text-gray-400">Leads the SKU: ORI-ACC-CLIP-WH</p>
          )}
        </div>

        {accessoryMode ? (
          <>
            <SkuSelect
              label="Accessory type"
              value={state.accessoryType}
              onChange={(v) => set({ accessoryType: v })}
              options={ACCESSORY_TYPE_OPTIONS}
            />
            {state.accessoryType === 'CUSTOM' && (
              <div>
                <label className={labelClass}>Custom accessory type</label>
                <input
                  className={inputClass}
                  value={state.accessoryTypeCustom}
                  onChange={(e) => set({ accessoryTypeCustom: e.target.value })}
                  placeholder="e.g. Clip, Adapter, Feed…"
                />
              </div>
            )}
            <SkuSelect label="Color / finish" value={state.color} onChange={(v) => set({ color: v })} options={COLOR_OPTIONS} />
            <SkuSelect label="Version" value={state.version} onChange={(v) => set({ version: v })} options={VERSION_OPTIONS} />
            {state.version === 'CUSTOM' && (
              <div>
                <label className={labelClass}>Custom version</label>
                <input
                  className={inputClass}
                  value={state.versionCustom}
                  onChange={(e) => set({ versionCustom: e.target.value })}
                  placeholder="e.g. V5, Rev A"
                />
              </div>
            )}
          </>
        ) : (
          <>
            <SkuSelect label="Size / format" value={state.dim} onChange={(v) => set({ dim: v })} options={DIM_OPTIONS} />
            {state.dim === 'CUSTOM' && (
              <div>
                <label className={labelClass}>Custom Text</label>
                <input
                  className={inputClass}
                  value={state.dimCustom}
                  onChange={(e) => set({ dimCustom: e.target.value })}
                  placeholder="e.g. 35x50, Mini, XL…"
                />
              </div>
            )}
            <SkuSelect label="Shape" value={shapeValue} onChange={chooseShape} options={SHAPE_OPTIONS} />
            {state.shape === 'L' && (
              <div>
                <label className={labelClass}>Length (mm)</label>
                <input className={inputClass} value={state.length} onChange={(e) => set({ length: e.target.value })} placeholder="e.g. 1200" />
              </div>
            )}
            <SkuSelect
              label={`Track${state.profile ? ' (clears profile)' : ''}`}
              value={state.track}
              onChange={chooseTrack}
              options={TRACK_OPTIONS}
              placeholder="— none —"
            />
            <SkuSelect
              label={`Profile${state.track ? ' (clears track)' : ''}`}
              value={state.profile}
              onChange={chooseProfile}
              options={PROFILE_OPTIONS}
              placeholder="— none —"
            />
            <div>
              <label className={labelClass}>Mounting type</label>
              <select className={selectClass} value={state.mounting} onChange={(e) => set({ mounting: e.target.value })}>
                <option value="">— choose —</option>
                {MONTAJE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </Section>

      {!accessoryMode && (
        <>
          <Section title="Light source">
            <SkuSelect label="Source (required)" value={state.source} onChange={(v) => set({ source: v })} options={SOURCE_OPTIONS} />
            <SkuSelect label="Socket" value={state.socket} onChange={(v) => set({ socket: v })} options={SOCKET_OPTIONS} />
            {state.socket === 'CUSTOM' && (
              <div>
                <label className={labelClass}>Custom socket</label>
                <input className={inputClass} value={state.socketCustom} onChange={(e) => set({ socketCustom: e.target.value })} placeholder="e.g. GX53, R7s" />
              </div>
            )}
            <SkuSelect label="Trim" value={state.trim} onChange={(v) => set({ trim: v })} options={TRIM_OPTIONS} />
            <SkuSelect label="Color / finish" value={state.color} onChange={(v) => set({ color: v })} options={COLOR_OPTIONS} />
            {onLumenChange && (
              <div>
                <label className={labelClass}>Lumen (lm)</label>
                <input
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  value={lumen ?? ''}
                  onChange={(e) => onLumenChange(e.target.value)}
                  placeholder="e.g. 1200"
                />
                <p className="mt-1 text-[11px] text-gray-400">Not in the SKU. Shows in General data &amp; description.</p>
              </div>
            )}
          </Section>

          <Section title="Light quality">
            <SkuSelect label="CRI" value={state.cri} onChange={(v) => set({ cri: v })} options={CRI_OPTIONS} />
            {state.cri === 'CUSTOM' && (
              <div>
                <label className={labelClass}>Custom CRI</label>
                <input className={inputClass} type="number" min="0" max="100" value={state.criCustom} onChange={(e) => set({ criCustom: e.target.value })} placeholder="e.g. 97" />
              </div>
            )}
            <SkuSelect label="CCT" value={state.cct} onChange={(v) => set({ cct: v })} options={CCT_OPTIONS} />
            {state.cct === 'CUSTOM' && (
              <div>
                <label className={labelClass}>Custom CCT (K)</label>
                <input className={inputClass} value={state.cctCustom} onChange={(e) => set({ cctCustom: e.target.value })} placeholder="e.g. 3300 or 2700-6500" />
              </div>
            )}
            <SkuSelect label="Optic / beam" value={state.optic} onChange={(v) => set({ optic: v })} options={OPTIC_OPTIONS} />
            {state.optic === 'CUSTOM' && (
              <div>
                <label className={labelClass}>Custom beam angle (°)</label>
                <input className={inputClass} type="number" min="1" max="360" value={state.opticCustom} onChange={(e) => set({ opticCustom: e.target.value })} placeholder="e.g. 11" />
              </div>
            )}
            <SkuSelect label="Power" value={state.watts} onChange={(v) => set({ watts: v })} options={WATTS_OPTIONS} />
            {state.watts === 'CUSTOM' && (
              <div>
                <label className={labelClass}>Custom power (W)</label>
                <input className={inputClass} type="number" min="0" step="0.1" value={state.wattsCustom} onChange={(e) => set({ wattsCustom: e.target.value })} placeholder="e.g. 18" />
              </div>
            )}
          </Section>

          <Section title="Electrical & control">
            <SkuSelect label="Driver" value={state.driver} onChange={(v) => set({ driver: v })} options={DRIVER_OPTIONS} />
            <SkuSelect label="Voltage / current" value={state.driverV} onChange={(v) => set({ driverV: v })} options={DRIVER_V_OPTIONS} />
            {state.driverV === 'CUSTOM' && (
              <div>
                <label className={labelClass}>Custom voltage / current</label>
                <input className={inputClass} value={state.driverVCustom} onChange={(e) => set({ driverVCustom: e.target.value })} placeholder="e.g. 48V DC, 1400mA" />
              </div>
            )}
            <SkuSelect label="Dimming / control" value={state.ctrl} onChange={(v) => set({ ctrl: v })} options={CTRL_OPTIONS} />
            <SkuSelect label="Version" value={state.version} onChange={(v) => set({ version: v })} options={VERSION_OPTIONS} />
            {state.version === 'CUSTOM' && (
              <div>
                <label className={labelClass}>Custom version</label>
                <input
                  className={inputClass}
                  value={state.versionCustom}
                  onChange={(e) => set({ versionCustom: e.target.value })}
                  placeholder="e.g. V5, Rev A"
                />
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
