import { createHmac, timingSafeEqual } from 'node:crypto';

const encodeVnpayValue = (value: string): string =>
  encodeURIComponent(value).replace(/%20/g, '+');

export function canonicalizeVnpayParameters(
  parameters: Record<string, string>,
): string {
  return Object.keys(parameters)
    .filter((key) => parameters[key] !== '')
    .sort()
    .map(
      (key) => `${encodeVnpayValue(key)}=${encodeVnpayValue(parameters[key])}`,
    )
    .join('&');
}

export function signVnpayParameters(
  parameters: Record<string, string>,
  hashSecret: string,
): string {
  return createHmac('sha512', hashSecret)
    .update(canonicalizeVnpayParameters(parameters), 'utf8')
    .digest('hex');
}

export function verifyVnpaySignature(
  parameters: Record<string, string>,
  receivedSignature: string,
  hashSecret: string,
): boolean {
  const expected = Buffer.from(
    signVnpayParameters(parameters, hashSecret),
    'utf8',
  );
  const received = Buffer.from(receivedSignature.toLowerCase(), 'utf8');
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
