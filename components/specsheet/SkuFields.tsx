'use client';

import {
  type SkuState,
  type SkuOption,
  buildSku,
  DIM_OPTIONS,
  SHAPE_OPTIONS,
  ACCESSORY_TYPE_OPTIONS,
  PROFILE_KIND_OPTIONS,
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
  DRIVER_IN_OPTIONS,
  DRIVER_V_OPTIONS,
  CTRL_OPTIONS,
  VERSION_OPTIONS,
  hasCopyMarker,
  trackOptionsForType,
} from '@/lib/sku/skuRules';
import { MONTAJE_OPTIONS } from '@/lib/sku/specSheet';
import { AdminSelect } from '@/components/ui/AdminSelect';

const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
const inputClass = selectClass;
const labelClass = 'block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5';

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
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <AdminSelect
        aria-label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        options={options.map((o) => ({
          value: o.value,
          label: o.label,
          group: o.group ?? null,
        }))}
      />
    </div>
  );
}

/**
 * One titled block of the Builder — Identity & format, Light source, and so on.
 * Exported because the sheet's own blocks (Characteristics) are read as part of
 * the same list of questions, so they are drawn the same way.
 */
export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
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

function MountingSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>Mounting type</label>
      <AdminSelect
        aria-label="Mounting type"
        value={value}
        onChange={onChange}
        options={[
          // Keep legacy value visible if still stored on the sheet.
          ...(value && !(MONTAJE_OPTIONS as readonly string[]).includes(value)
            ? [{ value, label: `${value} (legacy)` }]
            : []),
          ...MONTAJE_OPTIONS.map((m) => ({ value: m, label: m })),
        ]}
      />
    </div>
  );
}

/**
 * Finish, with the line for one that is not on the list.
 *
 * Kept together in one component because every builder — fixture, track, profile,
 * accessory — offers the same field, and a Custom option whose text box was left
 * out of one of them would build a SKU with the finish missing.
 */
function ColorField({
  state,
  set,
}: {
  state: SkuState;
  set: (patch: Partial<SkuState>) => void;
}) {
  return (
    <>
      <SkuSelect label="Color / finish" value={state.color} onChange={(v) => set({ color: v })} options={COLOR_OPTIONS} />
      {state.color === 'CUSTOM' && (
        <div>
          <label className={labelClass}>Custom color / finish</label>
          <input
            className={inputClass}
            value={state.colorCustom}
            onChange={(e) => set({ colorCustom: e.target.value })}
            placeholder="e.g. RAL 9016, Brushed copper"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            The SKU takes its letters and digits, up to 10 (
            <span className="font-mono">RAL 9016 → RAL9016</span>). The description and the
            variant&apos;s Finish keep it as typed.
          </p>
        </div>
      )}
    </>
  );
}

function ColorAndVersion({
  state,
  set,
}: {
  state: SkuState;
  set: (patch: Partial<SkuState>) => void;
}) {
  return (
    <>
      <ColorField state={state} set={set} />
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
  );
}

export function SkuFields({
  state,
  onChange,
  lumen,
  onLumenChange,
  /** Driven by Type = Accessories (not by Shape). */
  accessoryMode = false,
  /** Driven by Type = Track Line Voltage / Track Low Voltage. */
  trackMode = false,
  /** Driven by Type = LED Profiles. */
  profileMode = false,
  /** Current Type (subcategory) — filters track codes by voltage class. */
  subcategory = '',
  /** Product family, which leads the generated Name (e.g. "Maia"). */
  productName = '',
}: {
  state: SkuState;
  onChange: (s: SkuState) => void;
  lumen?: string;
  onLumenChange?: (v: string) => void;
  accessoryMode?: boolean;
  trackMode?: boolean;
  profileMode?: boolean;
  subcategory?: string;
  productName?: string;
}) {
  const set = (patch: Partial<SkuState>) => onChange({ ...state, ...patch });
  const r = buildSku(state);
  // Same composition the save writes, so the bar is not a second opinion.
  const name = [productName.trim(), r.nameBody].filter(Boolean).join(' ');

  const chooseTrack = (v: string) =>
    set(
      v
        ? { track: v, profile: '', profileKind: '', shape: state.shape === 'L' ? '' : state.shape }
        : { track: '' }
    );
  const chooseProfileKind = (v: string) =>
    set(
      v
        ? {
            profileKind: v,
            track: '',
            mounting: '', // Profiles use Profile type, not Mounting
            shape: state.shape === 'L' ? '' : state.shape,
          }
        : { profileKind: '' }
    );
  const chooseProfile = (v: string) =>
    set(
      v
        ? { profile: v, track: '', mounting: '', shape: state.shape === 'L' ? '' : state.shape }
        : { profile: '' }
    );
  const chooseShape = (v: string) =>
    set(v === 'L' ? { shape: v, track: '', profile: '', profileKind: '' } : { shape: v });

  // Shape dropdown is geometry only (R/S/L/RT). Never show ACC here.
  const shapeValue = state.shape === 'ACC' ? '' : state.shape;
  const trackOptions = trackOptionsForType(subcategory);

  const identityHint = accessoryMode
    ? 'Type Accessories → SKU is SERIES-ACC-TYPE-…'
    : trackMode
      ? 'Type Track → track system identity (no fixture photometrics)'
      : profileMode
        ? 'Type LED Profiles → Diffuser or Profile + length (like Track)'
        : undefined;

  return (
    <div className="space-y-8">
      {/* What the answers add up to: the commercial name on the left, and the two
          codes stacked on the right, short over long — the short one is the stem
          of the long one, so reading down shows what the extra segments add. */}
      <div className="bg-gray-900 text-white">
        <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400">Name</div>
            <div className="text-lg font-light uppercase tracking-wide break-words">
              {name || '—'}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-400">Short SKU</div>
              <div className="font-mono text-sm break-all">{r.shortCode || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-400">Long SKU</div>
              <div className="font-mono text-xs break-all text-gray-300">{r.longCode || '—'}</div>
            </div>
          </div>
        </div>

        {/* The mark is the only thing telling this variant apart from the one it was
            duplicated from, so it is explained next to the code it shows up in
            rather than in the Version field at the bottom. There is nothing to
            press: Save drops it as soon as the copy stands on its own. */}
        {hasCopyMarker(state) && (
          <p className="border-t border-gray-700 px-5 py-3 text-[11px] text-gray-400">
            Duplicate — <span className="font-mono text-gray-200">COPY</span> keeps this apart from
            the variant it came from. Change something (optic, CCT, finish…) and Save: the mark
            comes off on its own once the code stands alone.
          </p>
        )}
      </div>

      <Section title="Identity & format" hint={identityHint}>
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
            <ColorAndVersion state={state} set={set} />
          </>
        ) : trackMode ? (
          <>
            <SkuSelect
              label="Track system"
              value={state.track}
              onChange={chooseTrack}
              options={trackOptions}
              placeholder="— choose —"
            />
            <div>
              <label className={labelClass}>Length (mm)</label>
              <input
                className={inputClass}
                value={state.length}
                onChange={(e) => set({ length: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="e.g. 1000, 2000, 3000"
              />
              <p className="mt-1 text-[11px] text-gray-400">Same as linear: 1000 = 1 m, 2000 = 2 m, …</p>
            </div>
            <MountingSelect value={state.mounting} onChange={(v) => set({ mounting: v })} />
            <SkuSelect label="Trim" value={state.trim} onChange={(v) => set({ trim: v })} options={TRIM_OPTIONS} />
            <ColorAndVersion state={state} set={set} />
          </>
        ) : profileMode ? (
          <>
            <SkuSelect
              label="Diffuser / Profile"
              value={state.profileKind}
              onChange={chooseProfileKind}
              options={PROFILE_KIND_OPTIONS}
              placeholder="— choose —"
            />
            <div>
              <label className={labelClass}>Length (mm)</label>
              <input
                className={inputClass}
                value={state.length}
                onChange={(e) => set({ length: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="e.g. 1000, 2000, 3000"
              />
              <p className="mt-1 text-[11px] text-gray-400">Same as track: 1000 = 1 m, 2000 = 2 m, …</p>
            </div>
            <SkuSelect
              label="Profile type"
              value={state.profile}
              onChange={chooseProfile}
              options={PROFILE_OPTIONS}
              placeholder="— choose —"
            />
            {/* Mounting is represented by Profile type (SUR/REC/PEN…) in the SKU. */}
            <SkuSelect label="Trim" value={state.trim} onChange={(v) => set({ trim: v })} options={TRIM_OPTIONS} />
            <ColorAndVersion state={state} set={set} />
          </>
        ) : (
          <>
            <SkuSelect label="Size / format" value={state.dim} onChange={(v) => set({ dim: v })} options={DIM_OPTIONS} />
            {state.dim === 'CUSTOM' && (
              <div>
                <label className={labelClass}>Custom text</label>
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
            <MountingSelect value={state.mounting} onChange={(v) => set({ mounting: v })} />
            {/* Trim and finish describe the piece itself, not the light it makes. */}
            <SkuSelect label="Trim" value={state.trim} onChange={(v) => set({ trim: v })} options={TRIM_OPTIONS} />
            <ColorField state={state} set={set} />
          </>
        )}
      </Section>

      {/* Fixtures only: the light and what it comes out like, in one block.
          Track & LED Profiles: electrical only. */}
      {!accessoryMode && !trackMode && !profileMode && (
        <Section title="Light source">
          <SkuSelect label="Source (required)" value={state.source} onChange={(v) => set({ source: v })} options={SOURCE_OPTIONS} />
          <SkuSelect label="Socket" value={state.socket} onChange={(v) => set({ socket: v })} options={SOCKET_OPTIONS} />
          {state.socket === 'CUSTOM' && (
            <div>
              <label className={labelClass}>Custom socket</label>
              <input className={inputClass} value={state.socketCustom} onChange={(e) => set({ socketCustom: e.target.value })} placeholder="e.g. GX53, R7s" />
            </div>
          )}
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
      )}

      {!accessoryMode && (
        <Section
          title="Electrical & control"
          hint={
            trackMode
              ? 'Voltage / control for the track system'
              : profileMode
                ? 'Voltage / control for the profile / diffuser'
                : undefined
          }
        >
          <SkuSelect label="Driver" value={state.driver} onChange={(v) => set({ driver: v })} options={DRIVER_OPTIONS} />
          <SkuSelect label="CC / CV" value={state.driverV} onChange={(v) => set({ driverV: v })} options={DRIVER_V_OPTIONS} />
          {state.driverV === 'CUSTOM' && (
            <div>
              <label className={labelClass}>Custom CC / CV</label>
              <input className={inputClass} value={state.driverVCustom} onChange={(e) => set({ driverVCustom: e.target.value })} placeholder="e.g. 48V DC, 1400mA" />
            </div>
          )}
          <SkuSelect label="Enter voltage" value={state.driverIn} onChange={(v) => set({ driverIn: v })} options={DRIVER_IN_OPTIONS} />
          <SkuSelect label="Dimming / control" value={state.ctrl} onChange={(v) => set({ ctrl: v })} options={CTRL_OPTIONS} />
          {!trackMode && !profileMode && (
            <>
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
          )}
        </Section>
      )}
    </div>
  );
}
