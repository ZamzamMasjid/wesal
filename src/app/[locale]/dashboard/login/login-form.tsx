"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

type Problem = "invalid" | "tooMany" | "failed" | null;

const inputClass =
  "h-(--size-touch) w-full rounded-full border border-border bg-surface px-4 text-fg outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** Wrong credentials get one generic message, so the form never says which half was wrong. */
export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("Login");
  const router = useRouter();
  const ids = { user: useId(), pass: useId(), error: useId() };
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setProblem(null);
    try {
      const response = await fetch("/api/auth/sign-in/username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });
      if (response.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      setProblem(response.status === 429 ? "tooMany" : "invalid");
    } catch {
      setProblem("failed");
    }
    setPending(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg bg-surface p-6 shadow-md"
      aria-describedby={problem ? ids.error : undefined}
    >
      <div className="space-y-1">
        <label htmlFor={ids.user} className="text-sm font-medium">
          {t("username")}
        </label>
        <input
          id={ids.user}
          name="username"
          dir="ltr"
          autoComplete="username"
          autoCapitalize="none"
          required
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={ids.pass} className="text-sm font-medium">
          {t("password")}
        </label>
        <div className="relative">
          <input
            id={ids.pass}
            name="password"
            dir="ltr"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${inputClass} pe-12`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-e-1 top-1/2 size-10 -translate-y-1/2 rounded-full"
            aria-label={showPassword ? t("hide") : t("show")}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
        </div>
      </div>
      {problem && (
        <p
          id={ids.error}
          role="alert"
          className="rounded-sm bg-danger-soft p-3 text-sm text-danger"
        >
          {t(problem)}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="h-(--size-touch) w-full rounded-full"
      >
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
