import { describe, expect, it } from "vitest";

import { canonicalizeEmail } from "./canonicalizeEmail";

describe("canonicalizeEmail", () => {
  describe("Gmail plus addressing", () => {
    it("TC-01: removes plus tag from Gmail address", () => {
      expect(canonicalizeEmail("user+tag@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-02: removes plus tag with multiple characters", () => {
      expect(canonicalizeEmail("user+notification@gmail.com")).toBe(
        "user@gmail.com",
      );
    });

    it("TC-03: removes everything after plus", () => {
      expect(canonicalizeEmail("user+a+b@gmail.com")).toBe("user@gmail.com");
    });
  });

  describe("Gmail dot removal", () => {
    it("TC-04: removes dots from Gmail local part", () => {
      expect(canonicalizeEmail("u.s.e.r@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-05: removes single dot from Gmail local part", () => {
      expect(canonicalizeEmail("first.last@gmail.com")).toBe(
        "firstlast@gmail.com",
      );
    });

    it("TC-06: handles dot at start (edge case)", () => {
      expect(canonicalizeEmail(".user@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-07: handles dot at end (edge case)", () => {
      expect(canonicalizeEmail("user.@gmail.com")).toBe("user@gmail.com");
    });
  });

  describe("Gmail combined rules", () => {
    it("TC-08: removes both dots and plus tag", () => {
      expect(canonicalizeEmail("u.s.e.r+tag@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-09: handles complex combined case", () => {
      expect(canonicalizeEmail("u.s.e.r+notification+tag@gmail.com")).toBe(
        "user@gmail.com",
      );
    });

    it("TC-10: uppercase Gmail address with dots and plus", () => {
      expect(canonicalizeEmail("U.S.E.R+TAG@Gmail.COM")).toBe("user@gmail.com");
    });
  });

  describe("googlemail.com domain unification", () => {
    it("TC-11: converts googlemail.com to gmail.com", () => {
      expect(canonicalizeEmail("user@googlemail.com")).toBe("user@gmail.com");
    });

    it("TC-12: removes dots from googlemail address", () => {
      expect(canonicalizeEmail("u.s.e.r@googlemail.com")).toBe(
        "user@gmail.com",
      );
    });

    it("TC-13: removes plus from googlemail address", () => {
      expect(canonicalizeEmail("user+tag@googlemail.com")).toBe(
        "user@gmail.com",
      );
    });

    it("TC-14: handles uppercase googlemail.com", () => {
      expect(canonicalizeEmail("user@GoogleMail.COM")).toBe("user@gmail.com");
    });

    it("TC-15: handles both dots and plus on googlemail.com", () => {
      expect(canonicalizeEmail("u.s.e.r+tag@GOOGLEMAIL.COM")).toBe(
        "user@gmail.com",
      );
    });
  });

  describe("non-Gmail domain handling", () => {
    it("TC-16: preserves plus addressing in non-Gmail domains", () => {
      expect(canonicalizeEmail("user+tag@company.com")).toBe(
        "user+tag@company.com",
      );
    });

    it("TC-17: preserves dots in non-Gmail domains", () => {
      expect(canonicalizeEmail("user.name@company.com")).toBe(
        "user.name@company.com",
      );
    });

    it("TC-18: preserves both dots and plus in non-Gmail", () => {
      expect(canonicalizeEmail("user.name+tag@company.com")).toBe(
        "user.name+tag@company.com",
      );
    });

    it("TC-19: lowercase non-Gmail domain", () => {
      expect(canonicalizeEmail("user@example.com")).toBe("user@example.com");
    });

    it("TC-20: uppercase domain in non-Gmail", () => {
      expect(canonicalizeEmail("user@EXAMPLE.COM")).toBe("user@example.com");
    });
  });

  describe("trim and case normalization", () => {
    it("TC-21: trims leading whitespace", () => {
      expect(canonicalizeEmail("  user@example.com")).toBe("user@example.com");
    });

    it("TC-22: trims trailing whitespace", () => {
      expect(canonicalizeEmail("user@example.com  ")).toBe("user@example.com");
    });

    it("TC-23: trims both leading and trailing whitespace", () => {
      expect(canonicalizeEmail("  user@example.com  ")).toBe(
        "user@example.com",
      );
    });

    it("TC-24: converts uppercase to lowercase", () => {
      expect(canonicalizeEmail("USER@EXAMPLE.COM")).toBe("user@example.com");
    });

    it("TC-25: mixed case normalization", () => {
      expect(canonicalizeEmail("User@Example.COM")).toBe("user@example.com");
    });

    it("TC-26: whitespace and case combination", () => {
      expect(canonicalizeEmail("  User@Example.COM  ")).toBe(
        "user@example.com",
      );
    });
  });

  describe("edge cases", () => {
    it("TC-27: empty local part after plus removal", () => {
      expect(canonicalizeEmail("+tag@gmail.com")).toBe("@gmail.com");
    });

    it("TC-28: Gmail address with no special characters", () => {
      expect(canonicalizeEmail("user@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-29: multiple at signs (takes last @)", () => {
      expect(canonicalizeEmail("user+@fake@gmail.com")).toBe("user@gmail.com");
    });

    it("TC-30: no at sign - edge case", () => {
      expect(canonicalizeEmail("notanemail")).toBe("notanemail");
    });

    it("TC-31: whitespace only in local part (non-Gmail)", () => {
      expect(canonicalizeEmail("  @company.com")).toBe("@company.com");
    });

    it("TC-32: tab and newline characters", () => {
      expect(canonicalizeEmail("\t\nuser@example.com\n\t")).toBe(
        "user@example.com",
      );
    });
  });

  describe("determinism", () => {
    it("TC-33: same input produces same output", () => {
      const input = "User+Tag@Gmail.COM";
      const result1 = canonicalizeEmail(input);
      const result2 = canonicalizeEmail(input);
      expect(result1).toBe(result2);
    });

    it("TC-34: multiple calls are idempotent", () => {
      const input = "user@example.com";
      const result1 = canonicalizeEmail(input);
      const result2 = canonicalizeEmail(result1);
      expect(result1).toBe(result2);
    });
  });
});
