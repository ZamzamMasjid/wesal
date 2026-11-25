// @vitest-environment happy-dom
// SPEC: docs/design/views/schedule-editor.md — a slot's start and end are chosen on a clock face
// ROADMAP: phase-2-foundations / slot-schedule / Implement schedule-editor view: weekly grid, exceptions list, block a date
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";

import { TimePicker } from "./time-picker";

afterEach(cleanup);

function setup(value = "14:00") {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TimePicker label="Start time" value={value} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange };
}

describe("TimePicker", () => {
  it("shows the current time on the trigger", () => {
    setup("16:30");
    expect(
      screen.getByRole("button", { name: "Start time" }).textContent,
    ).toContain("4:30 PM");
  });

  it("picks an hour and a minute on the clock face", () => {
    const { onChange } = setup("14:00");
    fireEvent.click(screen.getByRole("button", { name: "Start time" }));
    fireEvent.click(screen.getByRole("button", { name: "Hour 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Minute 30" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onChange).toHaveBeenCalledWith("15:30");
  });

  it("switches the day period", () => {
    const { onChange } = setup("14:00");
    fireEvent.click(screen.getByRole("button", { name: "Start time" }));
    fireEvent.click(screen.getByRole("button", { name: "AM" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onChange).toHaveBeenCalledWith("02:00");
  });

  it("leaves the value alone when cancelled", () => {
    const { onChange } = setup("14:00");
    fireEvent.click(screen.getByRole("button", { name: "Start time" }));
    fireEvent.click(screen.getByRole("button", { name: "Hour 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
