export interface User {
  id: string;
  role: "owner" | "editor" | "viewer";
}

/** Every request is checked, even though the first release only has the local owner. */
export function can(user: User, action: "read" | "edit"): boolean {
  return action === "read" || user.role === "owner" || user.role === "editor";
}
