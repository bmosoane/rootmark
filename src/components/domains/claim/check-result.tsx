import type { CheckResult } from "@/domain/claim";

export function CheckResultMessage({
  result,
}: {
  result: CheckResult;
}) {
  switch (result.kind) {
    case "verified":
      return (
        <div className="result result-success" role="status">
          <span className="result-icon" aria-hidden="true">✓</span>
          <div>
            <strong>Proof record present</strong>
            <p>Public DNS still returns the expected TXT value.</p>
          </div>
        </div>
      );

    case "not_found":
      return (
        <div className="result" role="status">
          <span className="result-icon" aria-hidden="true">i</span>
          <div>
            <strong>We cannot see the record yet</strong>
            <p>
              Confirm that you changed DNS where the domain&apos;s nameservers are
              managed, then try again.
            </p>
          </div>
        </div>
      );

    case "wrong_value":
      return (
        <div className="result result-warning" role="status">
          <span className="result-icon" aria-hidden="true">!</span>
          <div>
            <strong>The host is correct, but the value does not match</strong>
            <p>Keep the host unchanged and replace only the TXT value.</p>
            <div className="result-observed-values">
              <span>Observed values</span>
              <code>{result.observed.join(" · ")}</code>
            </div>
          </div>
        </div>
      );

    case "wrong_host":
      return (
        <div className="result result-warning" role="status">
          <span className="result-icon" aria-hidden="true">!</span>
          <div>
            <strong>Your DNS provider appended the domain twice</strong>
            <p>
              Enter only <code>_rootmark</code> in the host field.
            </p>
          </div>
        </div>
      );

    case "lookup_failed":
      return (
        <div className="result result-neutral" role="status">
          <span className="result-icon" aria-hidden="true">↻</span>
          <div>
            <strong>We could not complete this check</strong>
            <p>
              This is not evidence that the record is wrong. Nothing changed—try
              again.
            </p>
          </div>
        </div>
      );

    case "rate_limited":
      return (
        <div className="result result-neutral" role="status">
          <span className="result-icon" aria-hidden="true">◷</span>
          <div>
            <strong>Give public DNS a moment</strong>
            <p>Try again in {result.retryAfterSeconds} seconds.</p>
          </div>
        </div>
      );

    case "already_claimed":
      return (
        <div className="result result-warning" role="status">
          <span className="result-icon" aria-hidden="true">!</span>
          <div>
            <strong>This domain is already claimed</strong>
            <p>
              We do not reveal its owner. A transfer would require a new proof.
            </p>
          </div>
        </div>
      );

    default:
      return assertNever(result);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled check result: ${JSON.stringify(value)}`);
}
