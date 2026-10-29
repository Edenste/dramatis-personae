<script lang="ts">
  import type { FixRequest, Problem } from "@dramatis-personae/schema";
  import Button from "../components/Button.svelte";

  let {
    worldName,
    problems,
    onfix,
  }: { worldName: string; problems: Problem[]; onfix: (request: FixRequest) => void } = $props();

  const count = $derived(problems.length === 1 ? "1 problem" : `${problems.length} problems`);

  function fixFor(problem: Problem): { label: string; request: FixRequest } | null {
    if (problem.fix === "removeReference" && problem.ref) {
      return {
        label: "Remove the reference",
        request: { fix: "removeReference", ref: problem.ref },
      };
    }
    if (problem.fix === "assignNewId") {
      return {
        label: "Give the copy a new ID",
        request: { fix: "assignNewId", path: problem.path },
      };
    }
    return null;
  }
</script>

<section>
  {#if problems.length === 0}
    <p class="none">No problems in {worldName}.</p>
  {:else}
    <h1>{count} in {worldName}</h1>
    <p class="lead">
      Files with problems are left as they are until fixed. The app won't overwrite them.
    </p>
    <ul>
      {#each problems as problem, index (`${problem.path}:${problem.code}:${index}`)}
        {@const fix = fixFor(problem)}
        <li>
          <span class="mark" aria-hidden="true"></span>
          <div class="text">
            <span>{problem.message}</span>
            <span class="where"
              ><code>{problem.path}</code>{#if problem.line !== undefined}, line {problem.line}{/if}</span
            >
          </div>
          {#if fix}
            <Button onclick={() => onfix(fix.request)}>{fix.label}</Button>
          {:else}
            <span class="manual">Fix in the file</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    max-width: 760px;
    padding: var(--space-5) var(--space-6);
  }

  h1 {
    margin: 0 0 var(--space-1);
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
  }

  .lead,
  .none {
    margin: 0 0 var(--space-3);
    color: var(--color-text-secondary);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 8px 1fr auto;
    gap: var(--space-3);
    align-items: start;
    padding: var(--space-3) 0;
    border-top: 1px solid var(--color-hairline);
  }

  .mark {
    width: 8px;
    height: 8px;
    margin-top: 5px;
    border-radius: 50%;
    background: var(--color-warning);
  }

  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .where {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
  }

  code {
    font-family: ui-monospace, "Cascadia Mono", Menlo, monospace;
  }

  .manual {
    padding-top: 3px;
    color: var(--color-text-secondary);
  }
</style>
