"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  Globe2,
  Menu,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Dialog, useApp, useCatalog } from "./providers";
import { SmoothScroll } from "./smooth-scroll";

const links = [
  { href: "/destinations", label: "Destinations" },
  { href: "/trips", label: "Our journeys" },
  { href: "/map", label: "Explore the map" },
  { href: "/journal", label: "Journal" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const { user, openAuth } = useApp();
  const { data } = useCatalog();
  const closeSearch = useCallback(() => setSearch(false), []);
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 50);
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [menu]);
  const dark = pathname === "/" && !scrolled && !menu;
  return (
    <>
      <SmoothScroll />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header
        className={`site-header ${dark ? "header-over-hero" : ""} ${scrolled ? "header-scrolled" : ""}`}
      >
        <div className="nav-inner">
          <Link
            href="/"
            className="wordmark"
            aria-label="Wanderline home"
            onClick={() => setMenu(false)}
          >
            <Compass size={29} strokeWidth={1.25} />
            <span>
              wanderline<span className="brand-dot">.</span>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map((link) => (
              <Link
                href={link.href}
                key={link.href}
                className={pathname.startsWith(link.href) ? "active" : ""}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <button
              className="icon-button"
              onClick={() => setSearch(true)}
              aria-label="Search destinations"
            >
              <Search size={20} />
            </button>
            <button
              className="icon-button account-button"
              aria-label={user ? "Your journeys" : "Sign in"}
              onClick={user ? undefined : openAuth}
            >
              {user ? (
                <Link href="/bookings" aria-label="Your journeys">
                  <UserRound size={20} />
                </Link>
              ) : (
                <UserRound size={20} />
              )}
            </button>
            <Link className="button nav-cta" href="/plan">
              <Sparkles size={15} />
              Plan my journey
              <ArrowUpRight size={16} />
            </Link>
            <button
              className="icon-button mobile-menu-button"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {[
              ...links,
              { href: "/plan", label: "Plan with AI" },
              { href: "/bookings", label: "My journeys" },
            ].map((link) => (
              <Link
                onClick={() => setMenu(false)}
                href={link.href}
                key={link.href}
              >
                {link.label}
                <ArrowUpRight size={22} />
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main id="main" className={pathname === "/" ? "" : "inner-main"}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="container footer-top">
          <div>
            <Link href="/" className="wordmark">
              <Compass size={30} strokeWidth={1.2} />
              <span>wanderline.</span>
            </Link>
            <p>For the places that stay with you.</p>
          </div>
          <div className="footer-nav">
            <Link href="/destinations">Find your somewhere</Link>
            <Link href="/trips">Our journeys</Link>
            <Link href="/journal">Stories from the road</Link>
            <Link href="/bookings">My journeys</Link>
          </div>
          <Link href="/plan" className="footer-invitation">
            Where will you go next?
            <ArrowUpRight size={28} />
          </Link>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} Wanderline. Travel thoughtfully.
          </span>
          <span>
            <Globe2 size={14} /> Made for a world worth exploring{" "}
            <span className="footer-currency">USD $</span>
          </span>
        </div>
      </footer>
      <AnimatePresence>
        {search && (
          <Dialog title="Find your next destination" onClose={closeSearch} wide>
            <p className="eyebrow">FOLLOW YOUR CURIOSITY</p>
            <h2>Find your somewhere.</h2>
            <div className="search-input">
              <Search size={20} />
              <input
                aria-label="Search by destination, country or feeling"
                placeholder="A place, a country, a feeling…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="search-results">
              {data.destinations
                .filter((item) =>
                  `${item.name} ${item.country} ${item.tags.join(" ")}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((item) => (
                  <Link
                    href={`/destinations/${item.slug}`}
                    key={item.id}
                    onClick={closeSearch}
                  >
                    <Image src={item.heroImage} alt="" width={75} height={65} />
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.country} · {item.tags[0]}
                      </small>
                    </span>
                    <ArrowRight size={20} />
                  </Link>
                ))}
              {!data.destinations.some((item) =>
                `${item.name} ${item.country} ${item.tags.join(" ")}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              ) && (
                <p className="muted">
                  No matches yet. Try “nature”, “Japan”, or “coast”.
                </p>
              )}
            </div>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}
