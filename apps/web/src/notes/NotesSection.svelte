<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import ConflictDialog from "../components/ConflictDialog.svelte";
  import { portraitSrc } from "../lib/portraits.ts";
  import { characterById, characterList, type WorldState } from "../lib/world-mirror.ts";
  import type { ProfileActions } from "../profile/actions.ts";
  import type { ProfileView } from "../profile/profile-view.ts";
  import { NotesAutosave } from "./autosave.ts";
  import NotesEditor from "./NotesEditor.svelte";

  // `state` is aliased: a variable named `state` would make `$state` read as a store.
  let {
    view,
    state: world,
    editable,
    actions,
  }: {
    view: ProfileView;
    state: WorldState;
    editable: boolean;
    actions: ProfileActions;
  } = $props();

  let editor: { setText(text: string): void } | undefined = $state();
  let conflict = $state(false);
  /** Set when the page is being hidden, so the last save is sent in a request that outlives it. */
  let leaving = false;

  // A profile is never reused for another character.
  const id = untrack(() => view.character.id);
  const key = `character:${id}`;

  const autosave = new NotesAutosave(
    {
      save: async (text, expectFingerprint) => {
        const result = await actions.runQuiet(
          {
            commands: [{ type: "character.update", id, set: { body: text } }],
            ...(expectFingerprint ? { expect: { [key]: expectFingerprint } } : {}),
          },
          leaving ? { keepalive: true } : undefined,
        );
        return result.ok
          ? { ok: true, fingerprint: result.result.fingerprints[key] ?? expectFingerprint ?? "" }
          : { ok: false, conflict: result.conflict };
      },
    },
    untrack(() => ({ body: view.character.body, fingerprint: view.fingerprint })),
  );
  autosave.onconflict = () => (conflict = true);

  // The file changed: show it if there is nothing unsaved to lose.
  $effect(() => {
    const { body } = view.character;
    if (autosave.remote(body, view.fingerprint) === "apply") editor?.setText(body);
  });

  // Closing the tab or card inside the pause must not lose the last words.
  onDestroy(() => void autosave.flush());

  const lookup = $derived((characterId: string) => characterById(world, characterId));

  async function keepMine(): Promise<void> {
    conflict = false;
    await autosave.resolve("mine");
  }

  async function takeTheirs(): Promise<void> {
    conflict = false;
    await autosave.resolve("theirs", { body: view.character.body, fingerprint: view.fingerprint });
    editor?.setText(view.character.body);
  }
</script>

<svelte:window
  onpagehide={() => {
    leaving = true;
    void autosave.flush();
  }}
/>

<NotesEditor
  bind:this={editor}
  body={view.character.body}
  {editable}
  toggleable={actions.canEdit}
  characters={lookup}
  list={() => characterList(world)}
  thumbnail={(characterId: string) => portraitSrc(world, actions.worldId, characterId)}
  onopen={(characterId: string) => actions.openCharacter(characterId)}
  onchange={(text: string) => autosave.edit(text)}
  onblur={() => void autosave.flush()}
/>

{#if conflict}
  <ConflictDialog onmine={() => void keepMine()} ontheirs={() => void takeTheirs()} />
{/if}
