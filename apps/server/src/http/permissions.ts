import { can, type User } from "@dramatis-personae/core";
import { ApiError } from "./errors.ts";

/** Reading a world or its interface state. */
export function requireRead(user: User): void {
  if (!can(user, "read")) throw new ApiError(403, "forbidden", "You can't open this world");
}

/** App-wide settings and actions on the machine itself are the owner's alone. */
export function requireOwner(user: User): void {
  if (user.role !== "owner") {
    throw new ApiError(403, "forbidden", "Only the app's owner can do that");
  }
}
