"use client";
import { Compass } from "lucide-react";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="container section">
      <div className="empty-state">
        <Compass size={40} />
        <h2>A small detour.</h2>
        <p>We couldn’t load this part of the journey. Please try again.</p>
        <button className="button button-dark" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
