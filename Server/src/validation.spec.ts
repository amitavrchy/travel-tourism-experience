import { email, futureDate, number } from './validation.js';

describe('Boundary validation', () => {
  it('normalizes addresses and rejects invalid input', () => {
    expect(email(' Traveler@Example.com ')).toBe('traveler@example.com');
    expect(() => email('not-an-email')).toThrow();
    expect(() => number(1.5, 'Guests', 1, 12)).toThrow();
    expect(() => number(Infinity, 'Budget', 1, 1000)).toThrow();
  });
  it('rejects past and impossible calendar dates', () => {
    expect(() => futureDate('2020-01-01')).toThrow();
    expect(() => futureDate('2027-02-30')).toThrow();
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(futureDate(tomorrow)).toBe(`${tomorrow}T00:00:00.000Z`);
  });
});
