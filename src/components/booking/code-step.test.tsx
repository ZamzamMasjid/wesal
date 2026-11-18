// @vitest-environment happy-dom
// SPEC: docs/features/phone-verification — code entry step with resend timer, automatic submit on the sixth digit, wrong-code and delivery-failure states
// ROADMAP: phase-2-foundations / phone-verification / Implement code entry step UI with resend timer and error states
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import type {
  ApiEnvelope,
  CodeCheckResult,
  CodeRequestResult,
} from "@/lib/verification-api";

import { CodeStep } from "./code-step";

afterEach(cleanup);

const phone = "+201001234567";
const sent: CodeRequestResult = {
  phone,
  channel: "whatsapp",
  expiresAt: "2026-01-01T10:05:00.000Z",
  resendAt: "2099-01-01T00:00:00.000Z",
};
const verified: CodeCheckResult = {
  token: "v1.token",
  phone,
  expiresAt: "2026-01-01T10:10:00.000Z",
  tokenMinutes: 10,
};

function renderStep(
  overrides: {
    requestCode?: () => Promise<ApiEnvelope<CodeRequestResult>>;
    checkCode?: () => Promise<ApiEnvelope<CodeCheckResult>>;
    onVerified?: (result: { token: string; phone: string }) => void;
    onChangeNumber?: () => void;
  } = {},
) {
  const onVerified = overrides.onVerified ?? vi.fn();
  const onChangeNumber = overrides.onChangeNumber ?? vi.fn();
  const requestCode =
    overrides.requestCode ?? vi.fn(async () => ({ ok: true, data: sent }));
  const checkCode =
    overrides.checkCode ?? vi.fn(async () => ({ ok: true, data: verified }));

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CodeStep
        phone={phone}
        onVerified={onVerified}
        onChangeNumber={onChangeNumber}
        requestCode={requestCode}
        checkCode={checkCode}
      />
    </NextIntlClientProvider>,
  );

  return { onVerified, onChangeNumber, requestCode, checkCode };
}

const codeInput = () =>
  screen.getByRole("textbox", { name: "Verification code" });

describe("CodeStep", () => {
  it("requests a code when it opens and shows the sent-to line", async () => {
    const { requestCode } = renderStep();

    expect(await screen.findByText(/We sent a code to/)).toBeTruthy();
    expect(requestCode).toHaveBeenCalledWith(phone);
    const resend = screen.getByRole("button", { name: /Resend code in/ });
    expect((resend as HTMLButtonElement).disabled).toBe(true);
  });

  it("submits automatically when the sixth digit is entered", async () => {
    const { checkCode, onVerified } = renderStep();
    await screen.findByText(/We sent a code to/);

    fireEvent.change(codeInput(), { target: { value: "123456" } });

    await waitFor(() => expect(onVerified).toHaveBeenCalledOnce());
    expect(checkCode).toHaveBeenCalledWith(phone, "123456");
    expect(onVerified).toHaveBeenCalledWith({ token: "v1.token", phone });
  });

  it("clears the boxes and says how many attempts are left after a wrong code", async () => {
    renderStep({
      checkCode: vi.fn(async () => ({
        ok: false,
        error: { code: "CODE_INVALID", details: { attemptsLeft: 4 } },
      })),
    });
    await screen.findByText(/We sent a code to/);

    fireEvent.change(codeInput(), { target: { value: "123456" } });

    expect(
      await screen.findByText(/That code is not correct\. 4 attempts left/),
    ).toBeTruthy();
    expect((codeInput() as HTMLInputElement).value).toBe("");
  });

  it("replaces the input with the venue contact when delivery fails", async () => {
    const onChangeNumber = vi.fn();
    renderStep({
      requestCode: vi.fn(async () => ({
        ok: false,
        error: {
          code: "CODE_DELIVERY_FAILED",
          details: { phone: "+201111111111", whatsapp: "+201222222222" },
        },
      })),
      onChangeNumber,
    });

    expect(
      await screen.findByText("We cannot send codes right now"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Call/ }).getAttribute("href"),
    ).toBe("tel:+201111111111");
    expect(
      screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href"),
    ).toBe("https://wa.me/201222222222");

    fireEvent.click(screen.getByRole("button", { name: "Change number" }));
    expect(onChangeNumber).toHaveBeenCalledOnce();
  });

  it("shows a rate-limit error and keeps the resend countdown", async () => {
    renderStep({
      requestCode: vi.fn(async () => ({
        ok: false,
        error: { code: "RATE_LIMITED", details: { retryAfterSeconds: 30 } },
      })),
    });

    expect(
      await screen.findByText(/Wait 30 seconds before trying again/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Resend code in/ })).toBeTruthy();
  });
});
