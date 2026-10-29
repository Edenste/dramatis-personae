<script lang="ts">
  import { untrack } from "svelte";
  import Button from "./Button.svelte";
  import Dialog from "./Dialog.svelte";

  let {
    mode,
    initial = "",
    onsubmit,
    onclose,
  }: {
    mode: "create" | "rename";
    initial?: string;
    onsubmit: (name: string) => void;
    onclose: () => void;
  } = $props();

  let name = $state(untrack(() => initial));
  const fieldId = `name-${Math.random().toString(36).slice(2)}`;
</script>

<Dialog title={mode === "create" ? "New world" : "Rename world"} {onclose}>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      if (name.trim()) onsubmit(name.trim());
    }}
  >
    <label for={fieldId}>Name</label>
    <input id={fieldId} bind:value={name} autocomplete="off" />
    <div class="actions">
      <Button variant="plain" onclick={onclose}>Cancel</Button>
      <Button variant="primary" type="submit" disabled={!name.trim()}>
        {mode === "create" ? "Create world" : "Rename"}
      </Button>
    </div>
  </form>
</Dialog>

<style>
  form {
    display: grid;
    gap: var(--space-2);
  }

  label {
    color: var(--color-text-secondary);
  }

  input {
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-outline);
    border-radius: var(--radius-control);
    background: var(--color-page);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
