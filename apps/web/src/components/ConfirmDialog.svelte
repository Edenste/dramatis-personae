<script lang="ts">
  import Button from "./Button.svelte";
  import Dialog from "./Dialog.svelte";

  let {
    title,
    message,
    confirm,
    onconfirm,
    oncancel,
  }: {
    title: string;
    message: string;
    /** The button that goes ahead: "Delete", "Remove". It is the dangerous one. */
    confirm: string;
    onconfirm: () => void;
    oncancel: () => void;
  } = $props();
</script>

<Dialog {title} onclose={oncancel}>
  <p>{message}</p>
  <div class="buttons">
    <Button onclick={oncancel}>Cancel</Button>
    <Button variant="danger" onclick={onconfirm}>{confirm}</Button>
  </div>
</Dialog>

<style>
  p {
    margin: 0 0 var(--space-4);
    color: var(--color-text-secondary);
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
