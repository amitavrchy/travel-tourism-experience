import { BadRequestException } from '@nestjs/common';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('A JSON object is required.');
  return value as Record<string, unknown>;
}
export function text(
  value: unknown,
  field: string,
  min = 1,
  max = 500,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new BadRequestException(
      `${field} must contain ${min}–${max} characters.`,
    );
  return value.trim();
}
export function number(
  value: unknown,
  field: string,
  min: number,
  max: number,
  integer = true,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new BadRequestException(
      `${field} must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}.`,
    );
  return value;
}
export function email(value: unknown): string {
  const result = text(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new BadRequestException('Enter a valid email address.');
  return result;
}
export function futureDate(value: unknown): string {
  const result = text(value, 'Start date', 10, 10);
  const date = new Date(`${result}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    Number.isNaN(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== result ||
    result < new Date().toISOString().slice(0, 10)
  )
    throw new BadRequestException(
      'Choose a valid start date from today onward.',
    );
  if (date.valueOf() > Date.now() + 2 * 366 * 86400000)
    throw new BadRequestException('Choose a date within the next two years.');
  return date.toISOString();
}
export function strings(
  value: unknown,
  field: string,
  maxLength = 80,
): string[] {
  if (!Array.isArray(value) || value.length > 15)
    throw new BadRequestException(
      `${field} must be a list of up to 15 values.`,
    );
  return value.map((item) => text(item, field, 1, maxLength));
}
