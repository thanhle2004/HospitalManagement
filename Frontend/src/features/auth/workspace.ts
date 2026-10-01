import type { StaffWorkspace } from "./types";

export function workspacePathFor(workspace: StaffWorkspace | null): string {
  if (workspace === "ADMIN") return "/admin";
  if (workspace === "DOCTOR") return "/doctor";
  return "/workspace-unavailable";
}
