/**
 * JWT authentication for the Alchemi API.
 *
 * Register → returns a signed JWT (HS256).
 * Login → validates credentials, returns a fresh token.
 * Protected tRPC routes verify the Bearer token from the Authorization header
 * and attach the decoded user to the context.
 *
 * In-memory user store (swappable for Mongo/Postgres in production):
 *   - email: unique identifier
 *   - passwordHash: SHA-256 hashed (use bcrypt/argon2 in production)
 *   - role: "user" | "admin"
 */
import jwt from "jsonwebtoken";
import { createHash, randomUUID } from "crypto";
import { env } from "./env";
import { logger } from "./logger";

export interface User {
  id: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
}

interface StoredUser extends User {
  passwordHash: string;
}

const users = new Map<string, StoredUser>(); // email → user

function hash(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function signToken(user: User): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn } as jwt.SignOptions
  );
}

export function verifyToken(token: string): User | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    return {
      id: decoded.sub as string,
      email: decoded.email,
      role: decoded.role,
      createdAt: "",
    };
  } catch {
    return null;
  }
}

export interface AuthResult {
  token: string;
  user: User;
}

export async function registerUser(
  email: string,
  password: string
): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  if (users.has(normalized)) {
    throw new Error("Email already registered");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const now = new Date().toISOString();
  const user: StoredUser = {
    id: randomUUID(),
    email: normalized,
    role: "user",
    createdAt: now,
    passwordHash: hash(password),
  };
  users.set(normalized, user);
  logger.info({ userId: user.id, email: normalized }, "User registered");
  const { passwordHash: _, ...publicUser } = user;
  return { token: signToken(publicUser), user: publicUser };
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const user = users.get(normalized);
  if (!user || user.passwordHash !== hash(password)) {
    throw new Error("Invalid email or password");
  }
  logger.info({ userId: user.id, email: normalized }, "User logged in");
  const { passwordHash: _, ...publicUser } = user;
  return { token: signToken(publicUser), user: publicUser };
}

export function getUserById(id: string): User | null {
  for (const user of users.values()) {
    if (user.id === id) {
      const { passwordHash: _, ...publicUser } = user;
      return publicUser;
    }
  }
  return null;
}

export function getUserCount(): number {
  return users.size;
}
