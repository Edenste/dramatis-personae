<script lang="ts">
  import { untrack } from "svelte";
  import type { DateValue } from "@dramatis-personae/schema";
  import { MONTHS } from "../format.ts";
  import "./controls.css";
  import type { ControlProps } from "./types.ts";

  let { value, label, onchange, onclear }: ControlProps = $props();

  /** The date's parts as the text the boxes show. */
  function partsOf(v: unknown) {
    const date = (v ?? {}) as Partial<DateValue>;
    return {
      day: date.day === undefined ? "" : String(date.day),
      month: date.month === undefined ? "" : String(date.month),
      year: date.year === undefined ? "" : String(date.year),
    };
  }

  let day = $state(untrack(() => partsOf(value).day));
  let month = $state(untrack(() => partsOf(value).month));
  let year = $state(untrack(() => partsOf(value).year));
  /** True while what's typed can't be a date, such as a day with no month. */
  let invalid = $state(false);

  // A change made elsewhere replaces what is shown.
  $effect(() => {
    const parts = partsOf(value);
    day = parts.day;
    month = parts.month;
    year = parts.year;
    invalid = false;
  });

  function commit(): void {
    const d = day.trim();
    const y = year.trim();
    invalid = false;
    if (d === "" && month === "" && y === "") {
      if (value !== undefined) onclear();
      return;
    }
    const dayNumber = d === "" ? undefined : Number(d);
    const badDay =
      dayNumber !== undefined &&
      (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31 || month === "");
    const badYear = y !== "" && !/^-?\d+$/.test(y);
    if (badDay || badYear) {
      invalid = true;
      return;
    }
    onchange({
      calendar: "gregorian",
      ...(y === "" ? {} : { year: Number(y) }),
      ...(month === "" ? {} : { month: Number(month) }),
      ...(dayNumber === undefined ? {} : { day: dayNumber }),
    });
  }
</script>

<div class="ctl date" class:invalid>
  <input
    type="text"
    inputmode="numeric"
    class="day tabular"
    aria-label="{label} day"
    placeholder="Day"
    bind:value={day}
    onblur={commit}
    onkeydown={(event) => event.key === "Enter" && commit()}
  />
  <select aria-label="{label} month" bind:value={month} onchange={commit}>
    <option value="">—</option>
    {#each MONTHS as name, i (name)}
      <option value={String(i + 1)}>{name}</option>
    {/each}
  </select>
  <input
    type="text"
    inputmode="numeric"
    class="year tabular"
    aria-label="{label} year"
    placeholder="Year"
    bind:value={year}
    onblur={commit}
    onkeydown={(event) => event.key === "Enter" && commit()}
  />
</div>

<style>
  .date {
    gap: var(--space-2);
  }

  .day {
    flex: 0 0 4ch;
  }

  .year {
    flex: 0 0 8ch;
    text-align: right;
  }

  select {
    flex: 1;
    min-width: 0;
    height: var(--size-control);
    border: none;
    background: none;
    font: inherit;
  }
</style>
