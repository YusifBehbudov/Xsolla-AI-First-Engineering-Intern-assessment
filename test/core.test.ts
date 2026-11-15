import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { reviewRepository } from "../src/core.js";

describe("reviewRepository", () => {
  it("refuses a missing repository path instead of inspecting the current folder", async () => {
    await expect(reviewRepository({ repositoryPath: undefined as unknown as string })).rejects.toThrow(
      /repositoryPath is required/,
    );
  });

  it("refuses a path that does not exist", async () => {
    await expect(reviewRepository({ repositoryPath: "/definitely/not/here" })).rejects.toThrow(
      /does not exist/,
    );
  });

  it("refuses a format it does not implement instead of silently ignoring it", async () => {
    await expect(reviewRepository({ repositoryPath: tmpdir(), format: "json" })).rejects.toThrow(
      /only "markdown" is implemented/,
    );
  });
});
