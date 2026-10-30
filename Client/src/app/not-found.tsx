import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";
export default function NotFound() {
  return (
    <div className="container section">
      <div className="empty-state">
        <Compass size={42} />
        <p
          className="eyebrow"
          style={{ justifyContent: "center", marginBottom: 15 }}
        >
          A LITTLE OFF THE BEATEN PATH
        </p>
        <h1>This path ends here.</h1>
        <p>
          That page has wandered off. There’s a whole world of other places to
          discover.
        </p>
        <Link className="button button-dark" href="/destinations">
          Find your somewhere
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </div>
  );
}
