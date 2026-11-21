"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";

interface StaffUser {
  id: string;
  name: string;
  username: string;
  role: "owner" | "staff";
  active: boolean;
  notifyPhone: string | null;
  notifyEnabled: boolean;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string };
}

async function call<T>(
  url: string,
  method: string,
  body?: unknown,
): Promise<Envelope<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return (await response.json()) as Envelope<T>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}

const inputClass =
  "h-(--size-touch-dense) w-full rounded-full border border-border bg-surface px-4 outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** The owner's staff list: add, disable or enable, reset a password. */
export function StaffManager() {
  const t = useTranslations("Dashboard.staff");
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notifyFor, setNotifyFor] = useState<StaffUser | null>(null);

  const load = useCallback(async () => {
    const result = await call<{ users: StaffUser[] }>(
      "/api/v1/staff/users",
      "GET",
    );
    if (result.ok && result.data) {
      setUsers(result.data.users);
      setLoadFailed(false);
    } else {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    // Fetch on mount; the state update happens when the response arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function errorText(code: string | undefined): string {
    if (code === "USERNAME_TAKEN") return t("taken");
    if (code === "LAST_OWNER") return t("lastOwner");
    if (code === "VALIDATION_FAILED") return t("invalid");
    return t("failed");
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const phone = String(data.get("notifyPhone") ?? "").trim();
    setCreating(true);
    setMessage(null);
    const result = await call("/api/v1/staff/users", "POST", {
      name: String(data.get("name") ?? ""),
      username: String(data.get("username") ?? ""),
      password: String(data.get("password") ?? ""),
      role: "staff",
      notifyPhone: phone === "" ? null : phone,
    });
    setCreating(false);
    if (result.ok) {
      form.reset();
      await load();
    } else {
      setMessage({ ok: false, text: errorText(result.error?.code) });
    }
  }

  async function setActive(user: StaffUser, active: boolean) {
    if (!active && !window.confirm(t("confirmDisable", { name: user.name }))) {
      return;
    }
    setMessage(null);
    const result = await call(`/api/v1/staff/users/${user.id}`, "PATCH", {
      active,
    });
    if (!result.ok) {
      setMessage({ ok: false, text: errorText(result.error?.code) });
    }
    await load();
  }

  async function resetPassword(user: StaffUser) {
    const password = window.prompt(t("newPasswordPrompt", { name: user.name }));
    if (!password) return;
    setMessage(null);
    const result = await call(`/api/v1/staff/users/${user.id}`, "PATCH", {
      password,
    });
    setMessage(
      result.ok
        ? { ok: true, text: t("passwordReset") }
        : { ok: false, text: errorText(result.error?.code) },
    );
  }

  const onlyOwner = users !== null && users.every((u) => u.role === "owner");

  return (
    <div className="space-y-6">
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={
            "rounded-sm p-3 text-sm " +
            (message.ok
              ? "bg-success-soft text-success"
              : "bg-danger-soft text-danger")
          }
        >
          {message.text}
        </p>
      )}

      {loadFailed && (
        <p role="alert" className="rounded-sm bg-danger-soft p-3 text-danger">
          {t("loadFailed")}
        </p>
      )}
      {users === null && !loadFailed && (
        <p className="text-muted">{t("loading")}</p>
      )}
      {users && (
        <div className="overflow-x-auto rounded-lg bg-surface shadow-md">
          <table className="w-full text-start text-sm">
            <thead className="text-muted">
              <tr>
                <th className="p-3 text-start">{t("name")}</th>
                <th className="p-3 text-start">{t("login")}</th>
                <th className="p-3 text-start">{t("status")}</th>
                <th className="p-3 text-start">{t("alerts")}</th>
                <th className="p-3 text-start">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="p-3">{user.name}</td>
                  <td className="p-3" dir="ltr">
                    {user.username}
                  </td>
                  <td className="p-3">
                    {user.active ? t("active") : t("disabled")}
                  </td>
                  <td className="p-3">
                    {user.notifyPhone ? (
                      <span className="flex flex-col">
                        <span dir="ltr">{user.notifyPhone}</span>
                        <span className="text-xs text-muted">
                          {user.notifyEnabled ? t("notifyOn") : t("notifyOff")}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted">{t("noPhone")}</span>
                    )}
                  </td>
                  <td className="flex flex-wrap gap-2 p-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNotifyFor(user)}
                    >
                      {t("editAlerts")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActive(user, !user.active)}
                    >
                      {user.active ? t("disable") : t("enable")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => resetPassword(user)}
                    >
                      {t("resetPassword")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {onlyOwner && <p className="text-muted">{t("empty")}</p>}

      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-lg bg-surface p-4 shadow-md sm:grid-cols-2"
      >
        <h2 className="text-xl font-bold sm:col-span-2">{t("add")}</h2>
        <label className="space-y-1 text-sm">
          {t("name")}
          <input name="name" required className={inputClass} />
        </label>
        <label className="space-y-1 text-sm">
          {t("login")}
          <input
            name="username"
            dir="ltr"
            required
            autoCapitalize="none"
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-sm">
          {t("initialPassword")}
          <input
            name="password"
            type="password"
            dir="ltr"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-sm">
          {t("notifyPhone")}
          <input
            name="notifyPhone"
            type="tel"
            dir="ltr"
            className={inputClass}
          />
        </label>
        <Button
          type="submit"
          disabled={creating}
          className="h-(--size-touch-dense) rounded-full sm:col-span-2"
        >
          {creating ? t("creating") : t("create")}
        </Button>
      </form>

      {notifyFor && (
        <NotificationDialog
          user={notifyFor}
          onClose={() => setNotifyFor(null)}
          onSaved={() => {
            setNotifyFor(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

/** The owner sets a staff member's alert phone and whether alerts are sent. */
function NotificationDialog({
  user,
  onClose,
  onSaved,
}: {
  user: StaffUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Dashboard.staff");
  const ref = useRef<HTMLDialogElement>(null);
  const [phone, setPhone] = useState(user.notifyPhone ?? "");
  const [enabled, setEnabled] = useState(user.notifyEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await call(`/api/v1/staff/users/${user.id}`, "PATCH", {
      notifyPhone: phone.trim() === "" ? null : phone.trim(),
      notifyEnabled: enabled,
    });
    setBusy(false);
    if (result.ok) onSaved();
    else if (result.error?.code === "VALIDATION_FAILED") setError(t("invalid"));
    else setError(t("failed"));
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="notify-title"
      onClose={onClose}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg bg-surface p-5 text-foreground shadow-md backdrop:bg-black/50"
    >
      <form onSubmit={save} className="space-y-4">
        <h2 id="notify-title" className="text-xl font-bold">
          {t("notifyTitle", { name: user.name })}
        </h2>
        <label className="block space-y-1 text-sm">
          {t("notifyPhone")}
          <input
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          {t("notifyEnabled")}
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-sm bg-danger-soft p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
