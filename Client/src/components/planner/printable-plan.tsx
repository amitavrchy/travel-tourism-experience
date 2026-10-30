import type { Itinerary, PlannerInput } from "@/lib/types";
import { money } from "@/lib/catalog";

export function PrintablePlan({
  plan,
  input,
}: {
  plan: Itinerary;
  input: PlannerInput;
}) {
  return (
    <article className="print-itinerary">
      <p>WANDERLINE · YOUR NEXT CHAPTER</p>
      <h1>{plan.title}</h1>
      <p>
        {input.days} days · {input.travelers} travelers ·{" "}
        {input.pace.toLowerCase()} pace
      </p>
      {plan.days.map((day) => (
        <section key={day.day}>
          <h2>
            Day {day.day} — {day.theme}
          </h2>
          {day.items.map((item, index) => (
            <div key={index}>
              <h3>
                {item.time} · {item.title}
              </h3>
              <p>{item.notes}</p>
            </div>
          ))}
        </section>
      ))}
      <section>
        <h2>A little practical magic.</h2>
        <p>
          Estimated total: {money(plan.estimatedBudget.min)}–
          {money(plan.estimatedBudget.max)} USD. International flights excluded.
        </p>
        {plan.tips.map((tip, i) => (
          <p key={i}>{tip}</p>
        ))}
      </section>
      <section>
        <h2>Our destination notes.</h2>
        {plan.sources.map((source) => (
          <div key={source.id}>
            <h3>{source.title}</h3>
            <p>{source.text}</p>
          </div>
        ))}
      </section>
      <p>
        A starting point, never a booking confirmation. Verify access, hours and
        availability before travel.
      </p>
    </article>
  );
}
