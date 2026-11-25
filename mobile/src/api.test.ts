// SPEC: customer-mobile-app/spec.md — the app talks to the same versioned JSON
// API as the website and shows the error codes it returns.
// ROADMAP: phase-7-mobile-app / customer-mobile-app / Scaffold Expo app with
// Arabic/English and RTL, consuming /api/v1

import {
  API_URL,
  absoluteUrl,
  checkVerificationCode,
  createHold,
  fetchAvailability,
  fetchBooking,
  fetchContent,
  fetchOccasions,
  fetchReviewQueue,
  lookupBooking,
  registerDevice,
  requestVerificationCode,
  signIn,
  staffMe,
  unregisterDevice,
  uploadProof,
} from "./api";

const fetchMock = jest.fn();

function reply(
  body: unknown,
  {
    status = 200,
    headers = {},
  }: {
    status?: number;
    headers?: Record<string, string>;
  } = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(async () => body),
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Response;
}

beforeEach(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  fetchMock.mockReset();
});

describe("the base URL", () => {
  it("comes from the configured environment and has no trailing slash", () => {
    expect(API_URL).toBe("http://api.test");
  });

  it("leaves absolute URLs alone and prefixes relative ones", () => {
    expect(absoluteUrl("https://cdn.example/photo.jpg")).toBe(
      "https://cdn.example/photo.jpg",
    );
    expect(absoluteUrl("http://cdn.example/photo.jpg")).toBe(
      "http://cdn.example/photo.jpg",
    );
    expect(absoluteUrl("/uploads/photo.jpg")).toBe(
      "http://api.test/uploads/photo.jpg",
    );
  });
});

describe("request", () => {
  it("returns the envelope and asks for JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      reply({
        ok: true,
        data: { content: { descriptionEn: "hall" }, media: [] },
      }),
    );

    await expect(fetchContent()).resolves.toEqual({
      ok: true,
      data: { content: { descriptionEn: "hall" }, media: [] },
    });
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/v1/content`, {
      headers: { accept: "application/json" },
    });
  });

  it("turns a network failure into NETWORK", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await expect(fetchOccasions()).resolves.toEqual({
      ok: false,
      error: { code: "NETWORK" },
    });
  });

  it("turns an unreadable body into NETWORK", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn(async () => {
        throw new SyntaxError("not json");
      }),
      headers: { get: () => null },
    } as unknown as Response);

    await expect(fetchContent()).resolves.toEqual({
      ok: false,
      error: { code: "NETWORK" },
    });
  });

  it("encodes availability query values", async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: true, data: { days: [] } }));

    await fetchAvailability("2026-11-01", "2026-12-31");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${API_URL}/api/v1/availability?from=2026-11-01&to=2026-12-31`,
    );
  });

  it("posts verification requests as JSON", async () => {
    fetchMock
      .mockResolvedValueOnce(
        reply({ ok: true, data: { phone: "01000000000" } }),
      )
      .mockResolvedValueOnce(reply({ ok: true, data: { token: "t" } }));

    await requestVerificationCode("01000000000", "ar");
    await checkVerificationCode("01000000000", "1234");

    expect(fetchMock.mock.calls[0]).toEqual([
      `${API_URL}/api/v1/verification/request`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ phone: "01000000000", locale: "ar" }),
      },
    ]);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ phone: "01000000000", code: "1234" }),
    });
  });

  it("posts a hold with every field the server needs", async () => {
    fetchMock.mockResolvedValueOnce(
      reply({ ok: true, data: { bookingId: "B1" } }),
    );
    const input = {
      day: "2026-11-25",
      start: "10:00",
      end: "12:00",
      occasionId: 3,
      name: "Mona",
      phone: "01000000000",
      token: "verified",
      locale: "en" as const,
    };

    await createHold(input);

    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/v1/bookings`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
  });

  it("encodes the booking token and lookup id", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ ok: true, data: {} }))
      .mockResolvedValueOnce(reply({ ok: true, data: {} }));

    await fetchBooking("a b/c");
    await lookupBooking("B 1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${API_URL}/api/v1/bookings/by-token/a%20b%2Fc`,
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `${API_URL}/api/v1/bookings/lookup?bookingId=B%201`,
    );
  });
});

describe("uploadProof", () => {
  const image = {
    uri: "file:///proof.jpg",
    mimeType: "image/jpeg",
    fileName: "proof.jpg",
  };

  it("sends the picked image as multipart form data", async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: true, data: { id: 7 } }));

    await expect(uploadProof("tok en", image)).resolves.toEqual({
      ok: true,
      data: { id: 7 },
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_URL}/api/v1/bookings/by-token/tok%20en/proof`);
    expect(init).toMatchObject({
      method: "POST",
      headers: { accept: "application/json" },
    });
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("returns NETWORK when the upload cannot be sent", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await expect(uploadProof("tok", image)).resolves.toEqual({
      ok: false,
      error: { code: "NETWORK" },
    });
  });
});

describe("signIn", () => {
  it("returns the session cookie Better Auth set", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(
        { user: { id: "u1" } },
        { headers: { "set-cookie": "session=abc; Path=/; HttpOnly" } },
      ),
    );

    await expect(signIn("owner", "secret")).resolves.toEqual({
      ok: true,
      data: { cookie: "session=abc" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/auth/sign-in/username`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "owner", password: "secret" }),
      },
    );
  });

  it("reports a rate limit distinctly", async () => {
    fetchMock.mockResolvedValueOnce(reply({}, { status: 429 }));

    await expect(signIn("owner", "secret")).resolves.toEqual({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
  });

  it("reports bad credentials as UNAUTHENTICATED", async () => {
    fetchMock.mockResolvedValueOnce(reply({}, { status: 401 }));

    await expect(signIn("owner", "wrong")).resolves.toEqual({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("treats a successful response without a cookie as UNAUTHENTICATED", async () => {
    fetchMock.mockResolvedValueOnce(reply({}));

    await expect(signIn("owner", "secret")).resolves.toEqual({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("reports a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await expect(signIn("owner", "secret")).resolves.toEqual({
      ok: false,
      error: { code: "NETWORK" },
    });
  });
});

describe("staff operations", () => {
  it("sends the session cookie to /me", async () => {
    fetchMock.mockResolvedValueOnce(
      reply({ ok: true, data: { id: "s1", name: "Sara", role: "staff" } }),
    );

    await staffMe("session=abc");

    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/v1/staff/me`, {
      headers: { accept: "application/json", cookie: "session=abc" },
    });
  });

  it("registers a device with its push token and platform", async () => {
    fetchMock.mockResolvedValueOnce(
      reply({ ok: true, data: { id: 9, platform: "ios" } }),
    );

    await registerDevice("session=abc", "ExponentPushToken[x]", "ios");

    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/v1/staff/devices`, {
      method: "POST",
      headers: {
        accept: "application/json",
        cookie: "session=abc",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token: "ExponentPushToken[x]",
        platform: "ios",
      }),
    });
  });

  it("unregisters a device by id", async () => {
    fetchMock.mockResolvedValueOnce(
      reply({ ok: true, data: { unregistered: true } }),
    );

    await unregisterDevice("session=abc", 9);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/v1/staff/devices/9`,
      {
        method: "DELETE",
        headers: { accept: "application/json", cookie: "session=abc" },
      },
    );
  });

  it("reads the review queue with the cookie", async () => {
    fetchMock.mockResolvedValueOnce(
      reply({ ok: true, data: { items: [], refreshedAt: "now" } }),
    );

    await fetchReviewQueue("session=abc");

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/v1/staff/review-queue`,
      {
        headers: { accept: "application/json", cookie: "session=abc" },
      },
    );
  });
});
