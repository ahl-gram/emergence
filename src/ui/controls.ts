import type { ParamSpec, Params } from "../core/types.js";

function decimalsOf(step: number): number {
  const s = String(step);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function formatValue(spec: ParamSpec, v: number): string {
  if (spec.options) return spec.options[v] ?? String(v);
  return v.toFixed(decimalsOf(spec.step));
}

/**
 * Render one control row per ParamSpec into `container`.
 * Sliders for numeric params, dropdowns for option params.
 */
export function buildParamControls(
  container: HTMLElement,
  specs: ParamSpec[],
  values: Params,
  onChange: (spec: ParamSpec, value: number) => void,
): void {
  container.replaceChildren();
  for (const spec of specs) {
    const row = document.createElement("label");
    row.className = "row";
    row.append(spec.label);

    if (spec.options) {
      const select = document.createElement("select");
      spec.options.forEach((name, i) => {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = name;
        select.append(opt);
      });
      select.value = String(values[spec.key] ?? spec.default);
      select.addEventListener("change", () => onChange(spec, Number(select.value)));
      row.append(select);
    } else {
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.value = String(values[spec.key] ?? spec.default);

      const val = document.createElement("span");
      val.className = "val";
      val.textContent = formatValue(spec, Number(input.value));

      input.addEventListener("input", () => {
        const v = clamp(Number(input.value), spec.min, spec.max);
        val.textContent = formatValue(spec, v);
        onChange(spec, v);
      });
      row.append(input, val);
    }
    container.append(row);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
}
