<script setup>
/**
 * A single-select segmented control built on vd3's button-group + button CSS
 * (vd3 has no dedicated segmented component). Reactive active state replaces the
 * old imperative `vd-is-active` toggling in Controls.js / main.js, while keeping
 * the same DOM shape (container id + `data-*` buttons) so the game's Playwright
 * selectors keep working.
 */
import { computed } from "vue";

const props = defineProps({
  /** Container id (e.g. "engine-choice") — preserved for tests. */
  id: { type: String, default: undefined },
  /** Explicit id for the label element (defaults to `${id}-label`). */
  labelId: { type: String, default: undefined },
  /** Visible group label; omit for an unlabeled group. */
  label: { type: String, default: "" },
  /** Accessible name for the group (falls back to `label`). */
  ariaLabel: { type: String, default: "" },
  /** data-* attribute key carrying each option value (mode|color|engine|level|perspective). */
  dataKey: { type: String, required: true },
  /** [{ value, label, tooltip?, title? }] */
  options: { type: Array, required: true },
  modelValue: { type: [String, Number], default: null },
  size: { type: String, default: "sm" },
  /** When true, the control is locked (e.g. a setting that can't change mid-game). */
  disabled: { type: Boolean, default: false },
  /** Native tooltip shown on the (non-disabled) group wrapper while locked. */
  disabledHint: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const resolvedLabelId = computed(
  () => props.labelId || (props.id ? `${props.id}-label` : undefined),
);

function select(value) {
  if (props.disabled) return;
  emit("update:modelValue", value);
}
</script>

<template>
  <div
    class="settings-group"
    :class="{ 'is-locked': disabled }"
    :title="disabled && disabledHint ? disabledHint : undefined"
  >
    <div v-if="label" :id="resolvedLabelId" class="settings-label">
      {{ label }}
      <i
        v-if="disabled"
        class="ph-duotone ph-lock-simple settings-lock"
        aria-hidden="true"
      ></i>
    </div>
    <div
      :id="id"
      class="vd-btn-group segmented"
      role="group"
      :aria-label="ariaLabel || label || undefined"
      :aria-labelledby="label ? resolvedLabelId : undefined"
      :aria-disabled="disabled ? 'true' : undefined"
    >
      <button
        v-for="opt in options"
        :key="String(opt.value)"
        type="button"
        class="vd-btn vd-btn-outline"
        :class="[`vd-btn-${size}`, { 'vd-is-active': modelValue === opt.value }]"
        :[`data-${dataKey}`]="opt.value"
        :title="opt.title || undefined"
        :disabled="disabled"
        :aria-pressed="modelValue === opt.value ? 'true' : 'false'"
        :data-tooltip="opt.tooltip || undefined"
        @click="select(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
