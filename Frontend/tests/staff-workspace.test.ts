import assert from "node:assert/strict";
import test from "node:test";
import { workspacePathFor } from "../src/features/auth/workspace.ts";

test("workspace selection maps only completed workspaces", () => {
  assert.equal(workspacePathFor("ADMIN"), "/admin");
  assert.equal(workspacePathFor("DOCTOR"), "/doctor");
});

test("missing workspace never falls through to Admin or Doctor", () => {
  assert.equal(workspacePathFor(null), "/workspace-unavailable");
});
