import { isIP } from "node:net";
import { domainToASCII } from "node:url";

export class InvalidDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDomainError";
  }
}

// DNS labels are 1–63 characters and cannot begin or end with a hyphen.
const LABEL_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function normalizeDomain(input: string): string {
  const candidate = input.trim().toLowerCase().replace(/\.$/, "");

  if (!candidate) {
    throw new InvalidDomainError("Enter a domain to continue.");
  }

  if (
    candidate.includes("://") ||
    candidate.includes("/") ||
    candidate.includes("@") ||
    candidate.includes(":")
  ) {
    throw new InvalidDomainError(
      "Enter only the domain, without https://, a path, port, or email address.",
    );
  }

  const ascii = domainToASCII(candidate);
  if (!ascii || ascii.length > 253 || isIP(ascii) !== 0) {
    throw new InvalidDomainError("Enter a valid domain name, not an IP address.");
  }

  const labels = ascii.split(".");
  if (labels.length < 2 || labels.some((label) => !LABEL_PATTERN.test(label))) {
    throw new InvalidDomainError(
      "Enter a complete domain such as example.com or app.example.com.",
    );
  }

  return ascii;
}
