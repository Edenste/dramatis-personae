<script lang="ts">
  let {
    checked,
    label,
    disabled = false,
    onchange,
  }: {
    checked: boolean;
    /** Names the switch for assistive technology. */
    label: string;
    disabled?: boolean;
    onchange: (checked: boolean) => void;
  } = $props();
</script>

<button
  type="button"
  role="switch"
  class="switch"
  class:on={checked}
  aria-checked={checked}
  aria-label={label}
  {disabled}
  onclick={() => onchange(!checked)}
>
  <span class="knob"></span>
</button>

<style>
  .switch {
    position: relative;
    flex-shrink: 0;
    width: calc(var(--size-control) + var(--space-3));
    height: var(--space-4);
    padding: 0;
    border: none;
    border-radius: var(--space-2);
    background: var(--color-outline);
    transition: background-color var(--motion-tab);
  }

  .switch.on {
    background: var(--color-accent);
  }

  .switch:disabled {
    opacity: 0.5;
  }

  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: calc(var(--space-4) - 4px);
    height: calc(var(--space-4) - 4px);
    border-radius: 50%;
    background: var(--color-on-accent);
    box-shadow: var(--shadow-raised);
    transition: transform var(--motion-tab) var(--ease-settle);
  }

  .on .knob {
    transform: translateX(calc(var(--size-control) + var(--space-3) - var(--space-4)));
  }
</style>
