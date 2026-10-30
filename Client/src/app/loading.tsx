export default function Loading() {
  return (
    <div
      className="container section"
      aria-busy="true"
      aria-label="Loading your next chapter"
    >
      <div
        className="skeleton"
        style={{ width: "40%", height: 65, marginBottom: 35 }}
      />
      <div className="three-grid">
        {[0, 1, 2].map((i) => (
          <div className="skeleton" key={i} style={{ height: 360 }} />
        ))}
      </div>
    </div>
  );
}
