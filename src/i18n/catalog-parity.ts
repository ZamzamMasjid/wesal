// Every user-facing string exists in Arabic and English (CLAUDE.md). This is a
// compile-time check, so `npm run typecheck` (and CI) fails when messages/ar.json
// and messages/en.json do not have exactly the same keys. No runtime code.
import type ar from "../../messages/ar.json";
import type en from "../../messages/en.json";

type KeyPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${KeyPaths<T[K]>}`;
}[keyof T & string];

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// If this line errors, a key is missing from one catalog or extra in the other.
export const catalogsHaveSameKeys: Same<
  KeyPaths<typeof ar>,
  KeyPaths<typeof en>
> = true;
