import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "../../../generated/prisma/client";

vi.mock("../../../lib/prisma", () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../../../lib/prisma";

const JWT_TEST_SECRET = "test-secret-for-vitest-only-1234567890";

let registerUser: typeof import("../auth.service").registerUser;
let loginUser: typeof import("../auth.service").loginUser;
let AuthError: typeof import("../auth.service").AuthError;

const mockedCreate = vi.mocked(prisma.user.create);
const mockedFindUnique = vi.mocked(prisma.user.findUnique);

const testUser = {
  id: "test-user-123",
  email: "traveler@example.com",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", JWT_TEST_SECRET);

  const service = await import("../auth.service.js");

  registerUser = service.registerUser;
  loginUser = service.loginUser;
  AuthError = service.AuthError;
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerUser", () => {
  it("hashes the password and returns a JWT", async () => {
    mockedCreate.mockResolvedValue({
      ...testUser,
    } as never);

    const result = await registerUser({
      email: "traveler@example.com",
      password: "StrongPassword123",
    });

    expect(mockedCreate).toHaveBeenCalledOnce();

    const createArgument = mockedCreate.mock.calls[0][0];

    expect(createArgument.data.email).toBe("traveler@example.com");
    expect(createArgument.data.passwordHash).not.toBe(
      "StrongPassword123",
    );

    expect(
      await bcrypt.compare(
        "StrongPassword123",
        createArgument.data.passwordHash,
      ),
    ).toBe(true);

    expect(result.user.email).toBe("traveler@example.com");
    expect(result.user).not.toHaveProperty("passwordHash");

    expect(
      jwt.verify(result.token, JWT_TEST_SECRET, {
        algorithms: ["HS256"],
      }),
    ).toMatchObject({
      sub: testUser.id,
    });
  });

  it("rejects duplicate email addresses", async () => {
    const duplicateError = Object.assign(
      Object.create(Prisma.PrismaClientKnownRequestError.prototype),
      { code: "P2002" },
    );

    mockedCreate.mockRejectedValue(duplicateError);

    await expect(
      registerUser({
        email: "traveler@example.com",
        password: "StrongPassword123",
      }),
    ).rejects.toMatchObject({
      name: "AuthError",
      statusCode: 409,
    });
  });

  it("rejects passwords exceeding bcrypt's byte limit", async () => {
    await expect(
      registerUser({
        email: "traveler@example.com",
        password: "a".repeat(73),
      }),
    ).rejects.toMatchObject({
      name: "AuthError",
      statusCode: 400,
    });

    expect(mockedCreate).not.toHaveBeenCalled();
  });
});

describe("loginUser", () => {
  it("authenticates a user with the correct password", async () => {
    const passwordHash = await bcrypt.hash(
      "StrongPassword123",
      4,
    );

    mockedFindUnique.mockResolvedValue({
      ...testUser,
      passwordHash,
      updatedAt: testUser.createdAt,
    } as never);

    const result = await loginUser({
      email: "traveler@example.com",
      password: "StrongPassword123",
    });

    expect(mockedFindUnique).toHaveBeenCalledOnce();
    expect(result.user.email).toBe("traveler@example.com");
    expect(result.user).not.toHaveProperty("passwordHash");

    expect(
      jwt.verify(result.token, JWT_TEST_SECRET, {
        algorithms: ["HS256"],
      }),
    ).toMatchObject({
      sub: testUser.id,
    });
  });

  it("rejects an incorrect password", async () => {
    const passwordHash = await bcrypt.hash(
      "StrongPassword123",
      4,
    );

    mockedFindUnique.mockResolvedValue({
      ...testUser,
      passwordHash,
      updatedAt: testUser.createdAt,
    } as never);

    await expect(
      loginUser({
        email: "traveler@example.com",
        password: "WrongPassword123",
      }),
    ).rejects.toMatchObject({
      name: "AuthError",
      statusCode: 401,
      message: "Invalid email or password",
    });
  });

  it("rejects an unknown email with the same authentication error", async () => {
    mockedFindUnique.mockResolvedValue(null);

    await expect(
      loginUser({
        email: "unknown@example.com",
        password: "StrongPassword123",
      }),
    ).rejects.toMatchObject({
      name: "AuthError",
      statusCode: 401,
      message: "Invalid email or password",
    });
  });
});