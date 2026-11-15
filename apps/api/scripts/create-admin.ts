import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { z } from "zod";

class AdminSetupError extends Error {}

export async function createAdministrator(input: {
  email?: string;
  password?: string;
  name?: string;
}) {
  const result = z
    .object({
      email: z
        .string()
        .trim()
        .email()
        .transform((value) => value.toLowerCase()),
      password: z
        .string()
        .min(12)
        .max(128)
        .refine(
          (value) => value.trim().length >= 12 && value !== "PharmaFlow!2026",
        ),
      name: z.string().trim().min(1).max(100),
    })
    .safeParse(input);
  if (!result.success)
    throw new AdminSetupError(
      "Set a valid ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD (12–128 characters, not the demo password).",
    );
  const { email, password, name } = result.data;
  const passwordHash = await argon2.hash(password);
  const db = new PrismaClient();
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(724839201)`;
      if (await tx.user.findUnique({ where: { email } }))
        throw new AdminSetupError(
          "This email already exists. Existing accounts are never overwritten.",
        );
      const user = await tx.user.create({
        data: { email, name, passwordHash, role: "admin", status: "active" },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    });
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  createAdministrator({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME ?? "Administrator",
  })
    .then(() =>
      console.log(
        "Created administrator account. Sign in using the configured credentials.",
      ),
    )
    .catch((error) => {
      console.error(
        error instanceof AdminSetupError
          ? error.message
          : "Administrator creation failed. Check database connectivity and migrations.",
      );
      process.exitCode = 1;
    });
}
