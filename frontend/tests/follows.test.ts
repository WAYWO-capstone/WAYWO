import { describe, expect, test } from "vitest";
import { ApiError } from "../src/lib/api";
import { followingStatusKey, isAlreadySettled } from "../src/lib/follows";

describe("isAlreadySettled", () => {
  test("treats 409 on follow as already following", () => {
    expect(isAlreadySettled(new ApiError(409), true)).toBe(true);
  });

  test("treats 404 on unfollow as already not following", () => {
    expect(isAlreadySettled(new ApiError(404), false)).toBe(true);
  });

  test("keeps real errors as errors", () => {
    expect(isAlreadySettled(new ApiError(404), true)).toBe(false);
    expect(isAlreadySettled(new ApiError(409), false)).toBe(false);
    expect(isAlreadySettled(new ApiError(401), true)).toBe(false);
    expect(isAlreadySettled(new Error("network"), true)).toBe(false);
  });
});

describe("followingStatusKey", () => {
  test("ignores username case and separates login sessions", () => {
    expect(followingStatusKey(1, "User2")).toEqual(followingStatusKey(1, "user2"));
    expect(followingStatusKey(1, "user2")).not.toEqual(followingStatusKey(2, "user2"));
  });
});