import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("featured destinations preserve vertical scrolling and support horizontal keyboard navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const rail = page.getByRole("region", { name: "Featured destinations" });
  await rail.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => window.scrollY);
  await rail.hover();
  await page.mouse.wheel(0, 500);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(before + 100);
  await rail.scrollIntoViewIfNeeded();
  await rail.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => rail.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(100);
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(() => rail.evaluate((element) => element.scrollLeft))
    .toBeLessThan(4);
});

test("all product text uses at least 14px on every primary page", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/destinations",
    "/trips",
    "/plan",
    "/bookings",
    "/admin",
    "/journal",
    "/map",
  ]) {
    await page.goto(path);
    await page.locator("h1").first().waitFor();
    const undersized = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            element instanceof HTMLElement &&
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            [...element.childNodes].some(
              (node) =>
                node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
            ) &&
            parseFloat(style.fontSize) < 14
          );
        })
        .map((element) => ({
          tag: element.tagName,
          class: element.className,
          size: getComputedStyle(element).fontSize,
        })),
    );
    expect(undersized, path).toEqual([]);
  }
});

async function register(page: Page) {
  await page.goto("/bookings");
  await page.getByRole("button", { name: "Sign in to your journeys" }).click();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your name").fill("Curious Traveler");
  await dialog
    .getByLabel("Email address")
    .fill(`traveler-${Date.now()}@wanderline.test`);
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("a-thoughtful-password-123");
  await dialog.getByRole("button", { name: "Create your account" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Curious." }),
  ).toBeVisible();
}

test("travel desk approvals unlock secure checkout and a cancelled checkout can be retried", async ({
  page,
  browser,
}) => {
  await register(page);
  const departure = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const response = await page.request.post("/api/bookings", {
    data: {
      packageId: "bali-t1",
      startDate: departure,
      guests: 1,
      email: "payment-test@example.com",
    },
  });
  expect(response.ok()).toBe(true);
  const booking = await response.json();
  await page.goto("/bookings?tab=bookings");
  await expect(page.getByRole("button", { name: /Pay securely/ })).toHaveCount(
    0,
  );
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto("/admin/payments");
  await admin.getByRole("button", { name: "Sign in to the studio" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Email address").fill("admin@wanderline.test");
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("browser-admin-password-123");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await admin
    .getByRole("textbox", { name: "Search travel desk" })
    .fill(booking.id);
  await admin.getByRole("button", { name: "Approve dates & total" }).click();
  await admin
    .getByRole("dialog")
    .getByRole("button", { name: "Approve booking", exact: true })
    .click();
  await expect(admin.locator(".operations-booking")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Pay securely/ }),
  ).toBeVisible();
  let requestedBooking = "";
  await page.route("**/api/payments/checkout", async (route) => {
    requestedBooking = route.request().postDataJSON().bookingId;
    await route.fulfill({
      json: {
        url: "https://checkout.stripe.com/c/pay/cs_test_browser_navigation",
      },
    });
  });
  await page.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Secure checkout</h1>",
    }),
  );
  await page.getByRole("button", { name: /Pay securely/ }).click();
  await page.waitForURL("https://checkout.stripe.com/**");
  expect(requestedBooking).toBe(booking.id);
  await page.goto("/payments/return?cancelled=1");
  await expect(
    page.getByRole("heading", { name: "Room to think it over." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View my journeys" }).click();
  await expect(
    page.getByRole("button", { name: /Pay securely/ }),
  ).toBeVisible();
  await adminContext.close();
});

test("finds destinations, filters results and handles an empty search", async ({
  page,
}) => {
  await page.goto("/destinations");
  await expect(page.getByRole("heading", { name: /Find your/ })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search destinations" })
    .fill("Japan");
  await expect(page.locator(".destination-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Kyoto", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search destinations" })
    .fill("somewhere-not-indexed");
  await expect(
    page.getByRole("heading", { name: "A little further afield?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".destination-card")).toHaveCount(6);
  await page.getByLabel("Filter by region").selectOption("Europe");
  await expect(page.locator(".destination-card")).toHaveCount(3);
  await expect(page.locator("body")).not.toHaveJSProperty("scrollWidth", 0);
});

test("explores destination pins and opens a destination", async ({ page }) => {
  await page.goto("/map");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(6);
  await page.getByRole("button", { name: "Kyoto Japan · Culture" }).click();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(4);
  await page
    .getByRole("link", { name: /Explore Kyoto and 3 local places/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kyoto", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".poi-row")).toHaveCount(3);
});

test("registers, sends a trip inquiry, persists it and cancels it", async ({
  page,
  context,
}) => {
  await register(page);
  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === "wl_session")?.httpOnly).toBe(
    true,
  );
  await page.goto("/trips/bali-beyond-the-ordinary");
  await page.getByLabel("Travelers", { exact: true }).selectOption("3");
  await page
    .getByLabel("Anything we should know?", { exact: false })
    .fill("A quiet escape with vegetarian meals, please.");
  await expect(page.locator(".booking-summary")).toContainText("$2,670");
  await page.getByRole("button", { name: "Send a booking inquiry" }).click();
  await expect(
    page.getByRole("heading", { name: /Your next chapter/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View my journeys" }).click();
  await page.getByRole("button", { name: /Booking inquiries/ }).click();
  await expect(page.locator(".inquiry-card")).toHaveCount(1);
  await expect(page.locator(".inquiry-card")).toContainText("3 travelers");
  await page.reload();
  await page.getByRole("button", { name: /Booking inquiries/ }).click();
  await expect(page.locator(".inquiry-card")).toContainText("$2,670");
  await page
    .getByRole("button", { name: "Cancel inquiry", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel inquiry", exact: true })
    .click();
  await expect(page.locator(".inquiry-card-top .status-badge")).toHaveText(
    "Cancelled",
  );
});

test("composes, edits, saves and reopens a personal itinerary", async ({
  page,
}) => {
  await register(page);
  await page.goto("/plan");
  await page.getByRole("button", { name: "A little more about you" }).click();
  await page.getByRole("button", { name: /Easy does it/ }).click();
  await page.getByRole("button", { name: "A little more about you" }).click();
  await page.getByRole("button", { name: "Compose my journey" }).click();
  await expect(
    page.getByRole("heading", { name: "Bali, at your own pace", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".day-accordion")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Make this day yours" })
    .first()
    .click();
  await page.getByLabel("Day theme").fill("A wonderfully unhurried morning");
  await page.getByRole("button", { name: "Keep these changes" }).click();
  await page.getByRole("button", { name: "Save my plan", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-itinerary")).toBeVisible();
  await expect(
    page.locator(".print-itinerary h2").filter({ hasText: /Day \d/ }),
  ).toHaveCount(5);
  await page.emulateMedia({ media: "screen" });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await download).suggestedFilename()).toContain("bali");
  await page.goto("/bookings");
  await expect(page.locator(".saved-plan")).toHaveCount(1);
  await page.getByRole("link", { name: "Open itinerary" }).click();
  await expect(
    page.getByRole("heading", {
      name: "A wonderfully unhurried morning",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Make this journey happen" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send a booking inquiry" })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: /Your next chapter/ }),
  ).toBeVisible();
});

test("cancels an in-progress planner request without leaving the wizard", async ({
  page,
}) => {
  await page.route("**/api/planner/stream", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    if (!route.request().isNavigationRequest())
      await route.abort().catch(() => undefined);
  });
  await page.goto("/plan");
  await page.getByRole("button", { name: "A little more about you" }).click();
  await page.getByRole("button", { name: "A little more about you" }).click();
  await page.getByRole("button", { name: "Compose my journey" }).click();
  await page.getByRole("button", { name: "Cancel planning" }).click();
  await expect(
    page.getByRole("heading", { name: "Make a little room." }),
  ).toBeVisible();
});

test("admin creates and removes a place through the studio", async ({
  page,
}, info) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign in to the studio" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email address").fill("admin@wanderline.test");
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("browser-admin-password-123");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Places of interest", exact: true })
    .click();
  await page.getByRole("button", { name: "Add a place" }).click();
  const editor = page.getByRole("dialog");
  const name = `A quiet test viewpoint ${info.project.name}`;
  await editor.getByLabel("Name", { exact: true }).fill(name);
  await editor
    .getByLabel("The story")
    .fill("A test place used to verify the editorial workflow.");
  await editor.getByLabel("Latitude").fill("-8.51");
  await editor.getByLabel("Longitude").fill("115.26");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.locator(".admin-table td:first-child").filter({ hasText: name }),
  ).toBeVisible();
  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove item", exact: true })
    .click();
  await expect(
    page.locator(".admin-table td:first-child").filter({ hasText: name }),
  ).toHaveCount(0);
});

test("navigation, public pages and reduced-motion layouts remain accessible", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydrat|did not match|cannot update/i.test(message.text())
    )
      errors.push(message.text());
  });
  for (const url of [
    "/",
    "/destinations",
    "/trips",
    "/journal",
    "/plan",
    "/bookings",
    "/admin",
    "/destinations/bali",
    "/trips/bali-beyond-the-ordinary",
    "/experiences/ubud-rice-and-roots",
    "/journal/the-art-of-slow-travel",
  ]) {
    await page.goto(url);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
      url,
    ).toEqual([]);
  }
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Destinations" })
      .click();
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation" }),
    ).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
