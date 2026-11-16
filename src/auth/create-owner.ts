// CLI: creates the first owner on a fresh database. Run in production with
//   fly ssh console -a wesal -t -C "node dist/create-owner.mjs --username owner --name Owner"
// The password is typed at a hidden prompt (or piped on stdin), never passed as
// an argument, so it stays out of shell history and logs.
import { parseArgs } from "node:util";

import { createDb, requireDatabaseUrl } from "@/db/client";

import { createFirstOwner } from "./first-owner";

function readPassword(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      let data = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (data += chunk));
      stdin.on("end", () => resolve(data.replace(/\r?\n$/, "")));
      stdin.on("error", reject);
      return;
    }
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (char: string) => {
      for (const c of char) {
        if (c === "\u0003") {
          stdin.setRawMode(false);
          reject(new Error("Cancelled."));
          return;
        }
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      username: { type: "string" },
      name: { type: "string" },
    },
  });
  if (!values.username || !values.name) {
    throw new Error(
      "Usage: create-owner --username <login> --name <display name>",
    );
  }
  const password = await readPassword("Password (min 8 characters): ");
  const { db, pool } = createDb(requireDatabaseUrl());
  try {
    await createFirstOwner(db, {
      username: values.username,
      name: values.name,
      password,
    });
    process.stdout.write(`Owner "${values.username}" created.\n`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `create-owner failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
