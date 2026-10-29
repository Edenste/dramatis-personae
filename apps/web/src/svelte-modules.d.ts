// svelte-check on this setup (TypeScript 6, Windows) doesn't resolve .svelte
// imports from .ts files, so declare them; the components themselves are
// still type-checked by svelte-check.
declare module "*.svelte" {
  import type { Component } from "svelte";
  const component: Component<Record<string, unknown>>;
  export default component;
}
