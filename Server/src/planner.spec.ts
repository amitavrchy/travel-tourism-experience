import { curatedPlan, validateInput } from './planner.js';
import { readFileSync } from 'node:fs';
import type { Row } from './store.service.js';
const data = JSON.parse(readFileSync('data/catalog.json', 'utf8')) as {
  destinations: Row[];
  pois: Row[];
  experiences: Row[];
};
describe('Grounded itinerary generation', () => {
  it('respects duration, pace and only references known places', () => {
    const input = validateInput({
      destinationSlug: 'bali',
      days: 5,
      travelers: 2,
      budget: 150,
      pace: 'RELAXED',
      vibes: ['Nature'],
      interests: [],
    });
    const plan = curatedPlan(
      input,
      data.destinations[0],
      data.pois.filter((p) => p.destinationId === 'bali'),
      [],
    );
    expect(plan.days).toHaveLength(5);
    expect(plan.sources.length).toBeGreaterThan(0);
    expect(plan.estimatedBudget.min).toBe(1200);
    for (const day of plan.days) {
      expect(day.items.filter((item) => item.type === 'poi')).toHaveLength(1);
      for (const item of day.items)
        expect(plan.sources.some((source) => source.id === item.sourceId)).toBe(
          true,
        );
    }
  });
  it('rejects invalid planner input and empty context', () => {
    expect(() => validateInput({ days: 100, pace: 'FAST' })).toThrow();
    expect(() =>
      curatedPlan(
        {
          destinationSlug: 'bali',
          days: 3,
          travelers: 1,
          budget: 100,
          pace: 'BALANCED',
          vibes: [],
          interests: [],
        },
        data.destinations[0],
        [],
        [],
      ),
    ).toThrow();
  });
});
