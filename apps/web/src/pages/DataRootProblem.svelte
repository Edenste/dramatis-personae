<script lang="ts">
  import type { Status } from "@dramatis-personae/schema";
  import Button from "../components/Button.svelte";
  import FolderChange from "../components/FolderChange.svelte";
  import type { Api } from "../lib/api.ts";

  let { api, status, onsettings }: { api: Api; status: Status; onsettings: () => void } = $props();
</script>

<section>
  <h1>Can't use the data folder</h1>
  <p>{status.problem ?? `${status.dataRoot} can't be written to.`}</p>
  <div class="actions">
    <FolderChange {api} desktop={status.desktop} label="Choose another folder…" />
    <Button variant="plain" onclick={onsettings}>Open settings</Button>
  </div>
</section>

<style>
  section {
    height: 100%;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-4);
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
  }

  p {
    max-width: 480px;
    margin: 0;
    color: var(--color-text-secondary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
