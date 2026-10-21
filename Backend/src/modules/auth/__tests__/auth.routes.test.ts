import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Set the JWT secret before application modules are imported.
vi.hoisted(() => {
  process.env.JWT_SECRET = "test-secret-for-vitest-only-1234567890";
});

// Mock Prisma so tests do not access the real database.
vi.mock("../../../lib/prisma", () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import app from "../../../app";
import { prisma } from "../../../lib/prisma";

const JWT_TEST_SECRET = "test-secret-for-vitest-only-1234567890";

const mockedCreate = vi.mocked(prisma.user.create);
const mockedFindUnique = vi.mocked(prisma.user.findUnique);

const testUser = {
  id: "test-user-123",
  email: "traveler@example.com",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", JWT_TEST_SECRET);
  vi.clearAllMocks();
});

// ---------------------------------------------
// POST /api/auth/register
// ---------------------------------------------

describe("POST /api/auth/register", () => {
  it("registers a user and never returns the password hash", async () => {
    mockedCreate.mockResolvedValue(testUser as never);

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        email: "traveler@example.com",
        password: "StrongPassword123",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("traveler@example.com");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(response.body.data.token).toBeTypeOf("string");

    expect(
      jwt.verify(response.body.data.token, JWT_TEST_SECRET, {
        algorithms: ["HS256"],
      }),
    ).toMatchObject({
      sub: testUser.id,
    });
  });

  it("rejects invalid registration input", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        email: "not-an-email",
        password: "short",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------
// POST /api/auth/login
// ---------------------------------------------

describe("POST /api/auth/login", () => {
  it("logs in a user with valid credentials", async () => {
    const passwordHash = await bcrypt.hash("StrongPassword123", 4);

    mockedFindUnique.mockResolvedValue({
      ...testUser,
      passwordHash,
      updatedAt: testUser.createdAt,
    } as never);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "traveler@example.com",
        password: "StrongPassword123",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("traveler@example.com");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(response.body.data.token).toBeTypeOf("string");

    expect(
      jwt.verify(response.body.data.token, JWT_TEST_SECRET, {
        algorithms: ["HS256"],
      }),
    ).toMatchObject({
      sub: testUser.id,
    });
  });

  it("rejects incorrect credentials", async () => {
    const passwordHash = await bcrypt.hash("StrongPassword123", 4);

    mockedFindUnique.mockResolvedValue({
      ...testUser,
      passwordHash,
      updatedAt: testUser.createdAt,
    } as never);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "traveler@example.com",
        password: "WrongPassword123",
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");
  });
});

// ---------------------------------------------
// GET /api/auth/me
// ---------------------------------------------

describe("GET /api/auth/me", () => {
  it("rejects requests without a token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });

  it("returns the authenticated user for a valid token", async () => {
    const token = jwt.sign({}, JWT_TEST_SECRET, {
      subject: testUser.id,
      expiresIn: "1h",
      algorithm: "HS256",
    });

    // Match the public fields selected by the /me controller.
    // The real Prisma query should exclude passwordHash.
    mockedFindUnique.mockResolvedValue(testUser as never);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.id).toBe(testUser.id);
    expect(response.body.data.user.email).toBe("traveler@example.com");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects an invalid token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid or expired token");
    expect(mockedFindUnique).not.toHaveBeenCalled();
  });
});