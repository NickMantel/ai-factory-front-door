import "server-only";
import { cookies } from "next/headers";
import { getUseCase, memberRole, renamedTo, type UseCase } from "./db";
import { SESSION_COOKIE, decodeSession, type User } from "./session";

// Who can see what:
// - owner / editor: the people on the use case. They see and work on it, drafts included.
// - coe: the AI CoE sees every submitted use case, never someone's private draft.
// - viewer: anyone signed in, read-only, when the owner opened a submitted use case to the organisation.

export type Access = "owner" | "editor" | "coe" | "viewer";

export async function currentUser(): Promise<User | null> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export function accessTo(user: User, uc: UseCase): Access | null {
  const member = memberRole(uc.id, user.email);
  if (member) return member;
  if (uc.status === "draft") return null;
  if (user.role === "coe") return "coe";
  if (uc.visibility === "public") return "viewer";
  return null;
}

export const canEdit = (a: Access | null) => a === "owner" || a === "editor";

/** A use case the person may see, for listing alongside another (e.g. similar use cases). */
export const visibleTo = (user: User, uc: UseCase) => accessTo(user, uc) !== null;

const deny = (status: number, error: string, extra: object = {}) => Response.json({ error, ...extra }, { status });

export async function requireUser(): Promise<User | Response> {
  return (await currentUser()) ?? deny(401, "Sign in to continue.");
}

export async function requireCoE(): Promise<User | Response> {
  const user = await currentUser();
  if (!user) return deny(401, "Sign in to continue.");
  return user.role === "coe" ? user : deny(403, "Only the AI CoE can see this.");
}

/**
 * Loads a use case and checks the person may act on it. Returns a Response to send back
 * when they can't; a draft that has since been submitted answers with where it moved.
 */
export async function guardUseCase(
  id: string,
  need: "view" | "edit" | "owner",
): Promise<{ user: User; uc: UseCase; access: Access } | Response> {
  const user = await currentUser();
  if (!user) return deny(401, "Sign in to continue.");
  const uc = getUseCase(id);
  if (!uc) {
    const movedTo = renamedTo(id);
    return movedTo ? deny(404, "This draft has been submitted.", { movedTo }) : deny(404, "Use case not found.");
  }
  const access = accessTo(user, uc);
  // Hidden use cases look the same as missing ones, so their existence isn't disclosed.
  if (!access) return deny(404, "Use case not found.");
  if (need === "edit" && !canEdit(access)) return deny(403, "Only people on this use case can change it.");
  if (need === "owner" && access !== "owner") return deny(403, "Only the owner can change who has access.");
  return { user, uc, access };
}
