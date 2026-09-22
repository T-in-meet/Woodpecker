import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { SET_PASSWORD_COMPLETE_PATH } from "@/features/auth/constants/routes";
import { SET_PASSWORD_INTENT_TTL_SECONDS } from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import { recordCurrentLegalAcceptances } from "@/features/auth/lib/userAgreements";
import { ROUTES } from "@/lib/constants/routes";

for (const envFile of [
  ".env.development.local",
  ".env.local",
  ".env.development",
  ".env",
]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

const INTENT_COOKIE = "set_password_intent";
const INTENT_PATH = "/set-password";
const TEST_PASSWORD = "Password123!";
const SIGNED_DESTINATION = ROUTES.NOTES;

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required for this E2E test`);
  }

  return value;
}

function createSetPasswordIntentToken(params: {
  userId: string;
  redirectPath: string;
  secret: string;
}): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    purpose: "signup-set-password",
    userId: params.userId,
    issuedAt,
    expiresAt: issuedAt + SET_PASSWORD_INTENT_TTL_SECONDS,
    redirectPath: params.redirectPath,
  };

  const payloadPart = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signaturePart = createHmac("sha256", params.secret)
    .update(payloadPart, "utf8")
    .digest("base64url");

  return `${payloadPart}.${signaturePart}`;
}

test.describe("Set Password completion production boundary", () => {
  test.setTimeout(60_000);
  test("실제 completion Route가 Path=/set-password Intent를 받고 clear한 뒤 signed destination으로 303 이동한다", async ({
    context,
    page,
  }, testInfo) => {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const signingSecret = requireEnv("PASSWORD_INTENT_SIGNING_SECRET");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });

    const uniqueSuffix = `${Date.now()}-${testInfo.workerIndex}`;
    const email = `set-password-e2e-${uniqueSuffix}@example.com`;
    const canonicalEmail = email.toLowerCase();
    const ipOctet = 10 + (Date.now() % 200);
    const testIp = `10.254.0.${ipOctet}`;

    let userId: string | null = null;

    try {
      const { data: createData, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password: TEST_PASSWORD,
          email_confirm: true,
          user_metadata: {
            nickname: "e2euser",
            canonical_email: canonicalEmail,
          },
        });

      expect(createError).toBeNull();
      expect(createData.user).not.toBeNull();

      userId = createData.user?.id ?? null;

      if (!userId) {
        throw new Error("E2E auth user was not created");
      }

      await recordCurrentLegalAcceptances(userId, "agreements_page");

      const loginResponse = await context.request.post("/api/auth/login", {
        headers: {
          "x-forwarded-for": testIp,
        },
        data: {
          email,
          password: TEST_PASSWORD,
        },
      });

      expect(loginResponse.status()).toBe(200);

      const intentToken = createSetPasswordIntentToken({
        userId,
        redirectPath: SIGNED_DESTINATION,
        secret: signingSecret,
      });

      await context.addCookies([
        {
          name: INTENT_COOKIE,
          value: intentToken,
          domain: "localhost",
          path: INTENT_PATH,
          httpOnly: true,
          sameSite: "Lax",
          secure: false,
        },
      ]);

      const cookieBeforeCompletion = (
        await context.cookies(
          `http://localhost:3000${SET_PASSWORD_COMPLETE_PATH}`,
        )
      ).find(
        (cookie) =>
          cookie.name === INTENT_COOKIE && cookie.path === INTENT_PATH,
      );

      expect(cookieBeforeCompletion?.value).toBe(intentToken);

      await page.route(`**${SIGNED_DESTINATION}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>signed destination</title>",
        });
      });

      const completionRequestPromise = page.waitForRequest((request) => {
        return new URL(request.url()).pathname === SET_PASSWORD_COMPLETE_PATH;
      });
      const completionResponsePromise = page.waitForResponse((response) => {
        return new URL(response.url()).pathname === SET_PASSWORD_COMPLETE_PATH;
      });

      await page.goto(SET_PASSWORD_COMPLETE_PATH);

      const completionRequest = await completionRequestPromise;
      const completionResponse = await completionResponsePromise;
      const completionRequestHeaders = await completionRequest.allHeaders();

      expect(completionRequestHeaders.cookie).toContain(
        `${INTENT_COOKIE}=${intentToken}`,
      );
      expect(completionResponse.status()).toBe(303);
      await expect(page).toHaveURL(
        `http://localhost:3000${SIGNED_DESTINATION}`,
      );

      const remainingIntentCookies = (await context.cookies()).filter(
        (cookie) =>
          cookie.name === INTENT_COOKIE && cookie.path === INTENT_PATH,
      );

      expect(remainingIntentCookies).toEqual([]);
    } finally {
      if (userId) {
        const { error: deleteError } =
          await admin.auth.admin.deleteUser(userId);

        expect(deleteError).toBeNull();
      }
    }
  });
});
