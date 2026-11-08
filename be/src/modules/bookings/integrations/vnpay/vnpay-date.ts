const VNPAY_DATE_PATTERN = /^\d{14}$/;

export function formatVnpayDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

export function parseVnpayDate(value: string | null): Date | null {
  if (!value || !VNPAY_DATE_PATTERN.test(value)) return null;
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hour = value.slice(8, 10);
  const minute = value.slice(10, 12);
  const second = value.slice(12, 14);
  const date = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}
