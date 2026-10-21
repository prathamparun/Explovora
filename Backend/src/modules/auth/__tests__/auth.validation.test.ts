import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../auth.validation";

describe("registerSchema", () => {
  it("accepts a valid email and password", () => {
    const result = registerSchema.safeParse({
      email: "traveler@example.com",
      password: "StrongPassword123",
    });

    expect(result.success).toBe(true);
  });

  it("normalizes email addresses to lowercase", () => {
    const result = registerSchema.safeParse({
      email: "TRAVELER@EXAMPLE.COM",
      password: "StrongPassword123",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.email).toBe("traveler@example.com");
    }
  });

  it("rejects an invalid email address", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "StrongPassword123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects passwords shorter than eight characters", () => {
    const result = registerSchema.safeParse({
      email: "traveler@example.com",
      password: "short",
    });

    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid login input", () => {
    const result = loginSchema.safeParse({
      email: "traveler@example.com",
      password: "StrongPassword123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "traveler@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});