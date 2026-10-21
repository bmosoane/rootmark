const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "longOffset",
});

export function formatLocalDateTime(value: string) {
  return dateTimeFormatter
    .formatToParts(new Date(value))
    .map((part) =>
      part.type === "timeZoneName"
        ? part.value.replace(/^GMT/, "UTC")
        : part.value,
    )
    .join("");
}
