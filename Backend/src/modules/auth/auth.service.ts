import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type { LoginInput, RegisterInput } from "./auth.validation";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET, "utf8") < 32) {
  throw new Error("JWT_SECRET must contain at least 32 bytes");
}

const JWT_EXPIRES_IN = "1h";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function createToken(userId: string): string {
  return jwt.sign({}, JWT_SECRET!, {
    subject: userId,
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
  });
}

function toPublicUser(user: {
  id: string;
  email: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export async function registerUser(input: RegisterInput) {
  if (Buffer.byteLength(input.password, "utf8") > 72) {
    throw new AuthError("Password is too long", 400);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    return {
      user: toPublicUser(user),
      token: createToken(user.id),
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AuthError("An account with this email already exists", 409);
    }

    throw error;
  }
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  // Use the same response for an unknown email and an incorrect password.
  if (!user) {
    throw new AuthError("Invalid email or password", 401);
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new AuthError("Invalid email or password", 401);
  }

  return {
    user: toPublicUser(user),
    token: createToken(user.id),
  };
}