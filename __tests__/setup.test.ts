import { describe, expect, it } from "vitest";

// Sanity checks for the Vitest setup itself (jsdom environment + the "@/" path
// alias). The real db/notes/actions suites live alongside this under __tests__/.
import { TitleSchema } from "@/lib/validation";

describe("vitest config", () => {
  it("runs in the jsdom environment", () => {
    expect(typeof window).toBe("object");
    expect(typeof document).toBe("object");
  });

  it("resolves the @/ path alias to project modules", () => {
    expect(TitleSchema.parse("  hello  ")).toBe("hello");
  });
});
