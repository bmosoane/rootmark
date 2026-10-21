import { describe, expect, it } from "vitest";
import { InvalidDomainError, normalizeDomain } from "./domain-name";

describe("normalizeDomain", () => {
  it.each([
    [" Example.COM. ", "example.com"],
    ["app.example.com", "app.example.com"],
    ["münich.example", "xn--mnich-kva.example"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each(["", "localhost", "https://example.com", "example.com/path", "127.0.0.1", "bad_label.example", "-bad.example"])(
    "rejects %s",
    (input) => { expect(() => normalizeDomain(input)).toThrow(InvalidDomainError); },
  );
});
