import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LinkEditPopover } from "../components/LinkEditPopover";

describe("LinkEditPopover", () => {
  it("calls onSubmit with the trimmed URL on Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <LinkEditPopover initialUrl="" onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    const input = screen.getByLabelText("링크 URL");
    await user.type(input, "https://example.com  ");
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledWith("https://example.com");
  });

  it("calls onSubmit with empty string when input is empty (removes link)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <LinkEditPopover initialUrl="" onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledWith("");
  });

  it("calls onCancel on Escape", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <LinkEditPopover initialUrl="" onSubmit={vi.fn()} onCancel={onCancel} />,
    );

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onSubmit when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <LinkEditPopover initialUrl="" onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    const input = screen.getByLabelText("링크 URL");
    await user.type(input, "https://example.com");
    await user.click(screen.getByLabelText("링크 확인"));

    expect(onSubmit).toHaveBeenCalledWith("https://example.com");
  });

  it("calls onCancel when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <LinkEditPopover initialUrl="" onSubmit={vi.fn()} onCancel={onCancel} />,
    );

    await user.click(screen.getByLabelText("취소"));

    expect(onCancel).toHaveBeenCalled();
  });

  it("pre-fills the input with initialUrl", () => {
    render(
      <LinkEditPopover
        initialUrl="https://existing.com"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("링크 URL")).toHaveValue(
      "https://existing.com",
    );
  });

  it("blocks javascript: protocol and shows error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <LinkEditPopover initialUrl="" onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    const input = screen.getByLabelText("링크 URL");
    await user.type(input, "javascript:alert(1)");
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("blocks data: protocol", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <LinkEditPopover initialUrl="" onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    const input = screen.getByLabelText("링크 URL");
    await user.type(input, "data:text/html,<h1>xss</h1>");
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("allows mailto: protocol", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <LinkEditPopover initialUrl="" onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    const input = screen.getByLabelText("링크 URL");
    await user.type(input, "mailto:test@example.com");
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledWith("mailto:test@example.com");
  });

  it("rejects invalid URLs", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <LinkEditPopover initialUrl="" onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    const input = screen.getByLabelText("링크 URL");
    await user.type(input, "not-a-url");
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
