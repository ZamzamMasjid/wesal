// @vitest-environment happy-dom
// SPEC: docs/features/payment-proof — the upload area shows the chosen image, reports progress, and turns each error code into one next step; the WhatsApp button carries the booking ID
// ROADMAP: phase-3-booking / payment-proof / Implement upload UI and WhatsApp button prefilled with the booking ID
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { MAX_PROOF_BYTES, uploadProof } from "@/lib/proof-api";

import { ProofUpload, type ProofUploadProps } from "./proof-upload";

vi.mock("@/lib/proof-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/proof-api")>();
  return { ...actual, uploadProof: vi.fn() };
});

vi.mock("@/lib/venue-contact", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/venue-contact")>();
  return {
    ...actual,
    venueContact: { phone: "+201001234567", whatsapp: "+201001234567" },
  };
});

const uploadMock = vi.mocked(uploadProof);

const uploaded = {
  status: "proof_submitted" as const,
  proofId: 12,
  uploadedAt: "2026-12-20T08:05:00.000Z",
};

function aFile(name = "proof.png", type = "image/png", bytes = [1, 2, 3]) {
  return new File([new Uint8Array(bytes)], name, { type });
}

function choose(file: File) {
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

function renderUpload(props: Partial<ProofUploadProps> = {}) {
  const onUploaded = vi.fn();
  const onExpired = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProofUpload
        token="token-one"
        bookingId="7K3M9Q"
        status="held"
        onUploaded={onUploaded}
        onExpired={onExpired}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onUploaded, onExpired };
}

beforeEach(() => {
  uploadMock.mockReset();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(cleanup);

describe("ProofUpload", () => {
  it("offers the upload action and a WhatsApp chat prefilled with the booking ID", () => {
    renderUpload();

    expect(
      screen.getByRole("button", { name: "Upload transfer screenshot" }),
    ).toBeTruthy();
    const link = screen.getByRole("link", { name: /WhatsApp/ });
    const expected = `https://wa.me/201001234567?text=${encodeURIComponent(
      "Deposit transfer proof for booking 7K3M9Q",
    )}`;
    expect(link.getAttribute("href")).toBe(expected);
  });

  it("offers another upload while the booking awaits review", () => {
    renderUpload({ status: "proof_submitted" });

    expect(
      screen.getByRole("button", { name: "Upload another screenshot" }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBeNull();
  });

  it("keeps the file input out of the tab order and the accessibility tree", () => {
    renderUpload();

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    // The visible button is the only upload control; a keyboard or screen-reader
    // user must not meet a second, invisible one.
    expect(input.hidden).toBe(true);
  });

  it("refuses a file that is not an accepted image before sending", () => {
    renderUpload();

    choose(aFile("proof.gif", "image/gif"));
    expect(screen.getByRole("alert").textContent).toContain(
      "Choose a JPEG, PNG or WebP image.",
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("refuses a file over the size cap without uploading it", () => {
    renderUpload();
    const big = aFile();
    Object.defineProperty(big, "size", { value: MAX_PROOF_BYTES + 1 });

    choose(big);
    expect(screen.getByRole("alert").textContent).toContain(
      "That image is larger than 10 MB.",
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("previews the chosen image, sends it and reports success", async () => {
    uploadMock.mockResolvedValue({ ok: true, data: uploaded });
    const { onUploaded } = renderUpload();

    choose(aFile());
    expect(
      screen.getByAltText("Preview of the chosen screenshot"),
    ).toBeTruthy();
    expect(screen.getByText("proof.png")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Send screenshot" }));

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(uploaded));
    expect(uploadMock).toHaveBeenCalledWith(
      "token-one",
      expect.any(File),
      expect.any(Function),
    );
    expect(screen.getByRole("status").textContent).toBe(
      "We received your screenshot.",
    );
  });

  it("turns an ended hold and a storage failure into one next step each", async () => {
    const { onExpired } = renderUpload();

    uploadMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "HOLD_EXPIRED" },
    });
    choose(aFile());
    fireEvent.click(screen.getByRole("button", { name: "Send screenshot" }));
    await waitFor(() => expect(onExpired).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert").textContent).toContain(
      "The hold ended before the screenshot arrived.",
    );

    choose(aFile());
    uploadMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "SERVICE_UNAVAILABLE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send screenshot" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "could not be saved right now",
      ),
    );
  });

  it("lets the customer open the picker again without losing the preview", () => {
    renderUpload();
    choose(aFile());
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const open = vi.spyOn(input, "click").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Choose another" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Send screenshot" }),
    ).toBeTruthy();
  });
});
