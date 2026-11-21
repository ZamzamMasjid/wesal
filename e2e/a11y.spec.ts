// SPEC: docs/features/landing-page — public views meet WCAG AA: landmarks, labels, heading order, contrast, keyboard operation and 360px layout
// ROADMAP: phase-5-public-site / landing-page / Run WCAG AA pass on public views and fix findings
// Needs the local database, the dev seed and, if present, `.env.local`.
// Temporarily seeds site content and one photo so the populated home is audited, then removes them.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function envValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const file = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const line = file
      .split(/\r?\n/)
      .find((candidate) => new RegExp(`^\\s*${name}\\s*=`).test(candidate));
    const value = line?.slice(line.indexOf("=") + 1).trim();
    return value ? value.replace(/^["']|["']$/g, "") : undefined;
  } catch {
    return undefined;
  }
}

function databaseUrl(): string {
  return (
    envValue("DATABASE_URL") ?? "postgres://wesal:wesal@localhost:5432/wesal"
  );
}

function uploadDir(): string {
  return (
    envValue("UPLOAD_DIR")?.trim() || path.join(process.cwd(), "db", "uploads")
  );
}

interface Seeded {
  bookingId: number;
  bookingToken: string;
  mediaId: number | null;
  mediaFile: string | null;
  contentKeys: string[];
  occasionId: number;
}

let client: Client;
let seeded: Seeded;

test.beforeAll(async () => {
  client = new Client({ connectionString: databaseUrl() });
  await client.connect();

  // A crashed earlier run may have left its booking behind.
  await client.query(
    "delete from booking where access_token like 'e2e-a11y-%'",
  );

  let occasionId: number | undefined = (
    await client.query("select id from occasion order by id limit 1")
  ).rows[0]?.id;
  if (!occasionId) {
    occasionId = (
      await client.query(
        `insert into occasion (name_ar, name_en, price_egp)
         values ('زفاف', 'Wedding', 15000) returning id`,
      )
    ).rows[0].id;
  }

  const existing = await client.query<{ key: string }>(
    "select key from site_content",
  );
  const have = new Set(existing.rows.map((row) => row.key));
  const wanted = [
    { key: "description", ar: "قاعة للمناسبات", en: "A hall for occasions" },
    {
      key: "policy",
      ar: "ادفع العربون\nثم ارفع الصورة",
      en: "Pay the deposit\nThen upload the screenshot",
    },
    { key: "contact_phone", ar: "01012345678", en: "01012345678" },
    { key: "contact_whatsapp", ar: "01098765432", en: "01098765432" },
  ];
  const contentKeys: string[] = [];
  for (const row of wanted) {
    if (have.has(row.key)) continue;
    await client.query(
      "insert into site_content (key, value_ar, value_en) values ($1, $2, $3)",
      [row.key, row.ar, row.en],
    );
    contentKeys.push(row.key);
  }

  let mediaId: number | null = null;
  let mediaFile: string | null = null;
  const mediaCount = await client.query(
    "select count(*)::int as n from media_asset",
  );
  if (mediaCount.rows[0].n === 0) {
    const name = `a11y-${randomUUID()}.png`;
    mediaFile = `media/${name}`;
    await mkdir(path.join(uploadDir(), "media"), { recursive: true });
    await writeFile(path.join(uploadDir(), mediaFile), PNG);
    mediaId = (
      await client.query(
        `insert into media_asset
           (kind, file_path, mime_type, byte_size, alt_ar, alt_en, position)
         values ('photo', $1, 'image/png', $2, 'القاعة الكبرى', 'The main hall', 0)
         returning id`,
        [mediaFile, PNG.byteLength],
      )
    ).rows[0].id;
  }

  const bookingToken = `e2e-a11y-${randomUUID()}`;
  const bookingId = (
    await client.query(
      `insert into booking (
         public_id, access_token, occasion_id, starts_at, ends_at, status,
         source, customer_name, customer_phone, locale, price_egp, deposit_egp,
         hold_expires_at
       ) values ('A11Y01', $1, $2, $3, $4, 'held', 'online', 'E2E Accessibility',
                 '+201001234567', 'en', 15000, 7500, now() + interval '20 minutes')
       returning id`,
      [
        bookingToken,
        occasionId,
        "2030-02-01T16:00:00Z",
        "2030-02-01T18:00:00Z",
      ],
    )
  ).rows[0].id;

  seeded = {
    bookingId,
    bookingToken,
    mediaId,
    mediaFile,
    contentKeys,
    occasionId: occasionId!,
  };
});

test.afterAll(async () => {
  if (!client) return;
  await client.query("delete from booking where id = $1", [seeded.bookingId]);
  if (seeded.mediaId !== null) {
    await client.query("delete from media_asset where id = $1", [
      seeded.mediaId,
    ]);
  }
  if (seeded.mediaFile) {
    await unlink(path.join(uploadDir(), seeded.mediaFile)).catch(
      () => undefined,
    );
  }
  if (seeded.contentKeys.length > 0) {
    await client.query("delete from site_content where key = any($1::text[])", [
      seeded.contentKeys,
    ]);
  }
  await client.end();
});

async function audit(page: Page, label: string) {
  await expect(page.locator("main")).toBeVisible();
  await page.waitForTimeout(250);
  const source = await readFileSync(
    path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js"),
    "utf8",
  );
  await page.addScriptTag({ content: source });
  const violations = await page.evaluate(async (tags) => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            context: Document,
            options: unknown,
          ) => Promise<{
            violations: {
              id: string;
              help: string;
              nodes: { target: string[]; failureSummary?: string }[];
            }[];
          }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: { type: "tag", values: tags },
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        failureSummary: node.failureSummary,
      })),
    }));
  }, TAGS);
  expect(
    violations,
    `${label}: ${JSON.stringify(violations, null, 2)}`,
  ).toEqual([]);
}

async function noSidewaysScroll(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${label} at 360px`).toBeLessThanOrEqual(1);
}

test("home passes WCAG AA in Arabic and English", async ({ page }) => {
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/`);
    await audit(page, `home ${prefix || "ar"}`);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${prefix}/`);
    await noSidewaysScroll(page, `home ${prefix || "ar"}`);
    await page.setViewportSize({ width: 1280, height: 800 });
  }
});

test("home and calendar pass WCAG AA in dark mode", async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("wesal-theme", "dark"),
  );
  await page.goto("/en/");
  await audit(page, "home dark");
  await page.goto("/en/calendar");
  await audit(page, "calendar dark");
});

test("calendar passes WCAG AA in Arabic", async ({ page }) => {
  await page.goto("/calendar");
  await audit(page, "calendar ar");
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/calendar");
  await noSidewaysScroll(page, "calendar ar");
});

test("booking form and find-booking pass WCAG AA", async ({ page }) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
  }).format(new Date());
  const later = new Date(`${today}T00:00:00Z`);
  later.setUTCDate(later.getUTCDate() + 30);
  const response = await page.request.get(
    `/api/v1/availability?from=${today}&to=${later.toISOString().slice(0, 10)}`,
  );
  const body = await response.json();
  const slot = body.data.days
    .flatMap(
      (day: {
        day: string;
        slots: { start: string; end: string; action: string }[];
      }) => day.slots.map((entry) => ({ day: day.day, ...entry })),
    )
    .find((entry: { action: string }) => entry.action === "book");

  if (slot) {
    await page.goto(
      `/book?day=${slot.day}&start=${encodeURIComponent(slot.start)}&end=${encodeURIComponent(slot.end)}&occasion=${seeded.occasionId}`,
    );
    await audit(page, "booking form");
  }

  await page.goto("/find-booking");
  await audit(page, "find booking");
});

test("private booking page passes WCAG AA", async ({ page }) => {
  await page.goto(`/en/booking/${seeded.bookingToken}`);
  await audit(page, "booking page en");
});
