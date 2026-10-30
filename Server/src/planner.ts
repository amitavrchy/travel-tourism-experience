import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { StoreService, type Row } from './store.service.js';
import { futureDate, number, object, strings, text } from './validation.js';

export type PlannerInput = {
  destinationSlug: string;
  days: number;
  travelers: number;
  budget: number;
  pace: 'RELAXED' | 'BALANCED' | 'PACKED';
  vibes: string[];
  interests: string[];
  startDate?: string;
};
export type Item = {
  time: string;
  title: string;
  type: 'poi' | 'experience' | 'meal' | 'transit';
  lat: number;
  lng: number;
  notes: string;
  sourceId?: string;
};
export type Plan = {
  title: string;
  days: { day: number; theme: string; items: Item[] }[];
  estimatedBudget: { currency: string; min: number; max: number };
  tips: string[];
  sources: { id: string; title: string; text: string }[];
  mode: 'curated' | 'ai';
};

export function validateInput(value: unknown): PlannerInput {
  const body = object(value);
  if (!['RELAXED', 'BALANCED', 'PACKED'].includes(String(body.pace)))
    throw new BadRequestException('Choose a valid travel pace.');
  return {
    destinationSlug: text(body.destinationSlug, 'Destination', 1, 120),
    days: number(body.days, 'Days', 3, 14),
    travelers: number(body.travelers, 'Travelers', 1, 12),
    budget: number(body.budget, 'Daily budget', 40, 1500),
    pace: body.pace as PlannerInput['pace'],
    vibes: strings(body.vibes || [], 'Vibes'),
    interests: strings(body.interests || [], 'Interests'),
    ...(body.startDate
      ? { startDate: futureDate(body.startDate).slice(0, 10) }
      : {}),
  };
}

export function curatedPlan(
  input: PlannerInput,
  destination: Row,
  pois: Row[],
  experiences: Row[],
): Plan {
  if (!pois.length)
    throw new BadRequestException(
      'We’re still gathering local knowledge for this destination. Please choose another place.',
    );
  const preference = [...input.vibes, ...input.interests]
    .join(' ')
    .toLowerCase();
  const ordered = [...pois].sort(
    (a, b) =>
      Number(preference.includes(String(b.kind).toLowerCase())) -
      Number(preference.includes(String(a.kind).toLowerCase())),
  );
  const count =
    input.pace === 'RELAXED' ? 1 : input.pace === 'BALANCED' ? 2 : 3;
  const sources = [
    {
      id: destination.id,
      title: String(destination.name),
      text: String(destination.embedText),
    },
    ...pois.map((poi) => ({
      id: poi.id,
      title: String(poi.name),
      text: String(poi.description),
    })),
    ...experiences.map((e) => ({
      id: e.id,
      title: String(e.title),
      text: String(e.summary),
    })),
  ];
  const days = Array.from({ length: input.days }, (_, index) => {
    const chosen = Array.from(
      { length: count },
      (_, n) => ordered[(index * count + n) % ordered.length],
    );
    const point = chosen[0];
    const item = (
      time: string,
      title: string,
      type: Item['type'],
      notes: string,
      source = point,
    ): Item => ({
      time,
      title,
      type,
      lat: Number(source.lat ?? destination.lat),
      lng: Number(source.lng ?? destination.lng),
      notes,
      sourceId: source.id,
    });
    const activities = chosen.map((poi, n) =>
      item(
        ['09:00', '14:00', '16:00'][n],
        String(poi.name),
        'poi',
        `${poi.description} ${index > 1 ? 'A chance to revisit from a different perspective. ' : ''}Allow 60–90 minutes between areas; check access locally.`,
        poi,
      ),
    );
    const experience = experiences[0];
    if (
      index === 1 &&
      experience &&
      Number(experience.durationHours) <= 4 &&
      Number(experience.priceFrom) < input.budget * 0.7 &&
      preference.includes('local')
    ) {
      activities.splice(
        0,
        activities.length,
        item(
          '09:00',
          String(experience.title),
          'experience',
          `${experience.summary} Allow ${experience.durationHours} hours; host availability must be confirmed.`,
          experience,
        ),
      );
    }
    const items = [
      ...activities,
      item(
        '12:30',
        'Lunch at a local table',
        'meal',
        'Choose a nearby locally owned café. Ask about dietary requirements and current prices.',
      ),
      ...(input.pace === 'RELAXED'
        ? [
            item(
              '15:00',
              'An afternoon at your own pace',
              'transit',
              'Leave space to rest or explore your neighborhood. No additional timed visit.',
            ),
          ]
        : []),
      item(
        '18:30',
        'A slow evening & dinner',
        'meal',
        'Return to your base with a generous travel buffer. Dinner is a flexible suggestion, not a restaurant reservation.',
      ),
    ].sort((a, b) => a.time.localeCompare(b.time));
    return {
      day: index + 1,
      theme:
        index === 0
          ? `Find your rhythm in ${destination.name}`
          : index === input.days - 1
            ? 'One more day to make it yours'
            : `${point.kind}, connection & a little curiosity`,
      items,
    };
  });
  const total = input.days * input.travelers * input.budget;
  return {
    title: `${destination.name}, at your own pace`,
    days,
    estimatedBudget: {
      currency: 'USD',
      min: Math.round(total * 0.8),
      max: Math.round(total * 1.2),
    },
    tips: [
      `${destination.bestSeason} is a good starting point for planning; conditions vary.`,
      'Budget is an estimate for all travelers, including stays, local transport and meals. International flights are excluded.',
      'Opening hours, access, local transport and host availability must be checked before booking.',
      ...(input.days > 5
        ? [
            'This longer stay intentionally revisits a small set of verified places. Ask a local host to expand your options.',
          ]
        : []),
      ...(input.budget < 100
        ? [
            'This budget may be tight for private accommodation or transfers; consider shared stays and public transport.',
          ]
        : []),
    ],
    sources,
    mode: 'curated',
  };
}

@Controller('planner')
export class PlannerController {
  constructor(private readonly store: StoreService) {}
  @Get('health') async health() {
    try {
      const response = await fetch(
        `${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'}/health`,
        { signal: AbortSignal.timeout(2000) },
      );
      return await response.json();
    } catch {
      return {
        status: 'ok',
        mode: 'curated',
        reason:
          'AI service is not connected. The grounded local planner is available.',
      };
    }
  }
  private async generate(
    input: PlannerInput,
    signal?: AbortSignal,
  ): Promise<Plan> {
    const destination = await this.store.find(
      'destinations',
      input.destinationSlug,
    );
    const pois = (await this.store.all('pois')).filter(
      (poi) => poi.destinationId === destination.id,
    );
    const experiences = (await this.store.all('experiences')).filter(
      (e) => e.destinationId === destination.id,
    );
    const fallback = curatedPlan(input, destination, pois, experiences);
    try {
      const response = await fetch(
        `${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'}/plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Key': process.env.AI_SERVICE_KEY || '',
          },
          body: JSON.stringify({
            ...input,
            context: { destination, pois, experiences },
          }),
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(75000)])
            : AbortSignal.timeout(75000),
        },
      );
      if (response.ok) {
        const plan = (await response.json()) as Plan;
        if (
          plan.days?.length === input.days &&
          plan.sources?.length &&
          ['ai', 'curated'].includes(plan.mode)
        )
          return plan;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
    return fallback;
  }
  @Post('generate') generateJson(@Body() body: unknown) {
    return this.generate(validateInput(body));
  }
  @Post('stream') async stream(
    @Body() body: unknown,
    @Req() _request: Request,
    @Res() response: Response,
  ) {
    const input = validateInput(body);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    const controller = new AbortController();
    response.on('close', () => controller.abort());
    const send = (event: string, data: unknown) => {
      if (!response.destroyed)
        response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    send('progress', {
      message: 'Gathering local knowledge and connecting your interests…',
    });
    const heartbeat = setInterval(() => {
      if (!response.destroyed) response.write(': planning\n\n');
    }, 15000);
    try {
      const plan = await this.generate(input, controller.signal);
      for (const day of plan.days) send('day', day);
      send('complete', plan);
    } catch (error) {
      if (!controller.signal.aborted)
        send('error', {
          message:
            (error as Error).message ||
            'We couldn’t compose this itinerary. Please try again.',
        });
    } finally {
      clearInterval(heartbeat);
      response.end();
    }
  }
}
