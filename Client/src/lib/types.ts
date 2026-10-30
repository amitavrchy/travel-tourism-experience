export type Destination = {
  id: string;
  slug: string;
  name: string;
  country: string;
  region: string;
  tagline: string;
  description: string;
  heroImage: string;
  lat: number;
  lng: number;
  bestMonths: number[];
  tags: string[];
  embedText: string;
  color: string;
  startingPrice: number;
  reading: string;
  bestSeason: string;
  timezone: string;
};
export type Poi = {
  id: string;
  destinationId: string;
  name: string;
  kind: string;
  description: string;
  lat: number;
  lng: number;
};
export type Experience = {
  id: string;
  destinationId: string;
  slug: string;
  title: string;
  summary: string;
  durationHours: number;
  priceFrom: number;
  difficulty: string;
  imageUrl: string;
};
export type Trip = {
  id: string;
  destinationId: string;
  slug: string;
  title: string;
  days: number;
  priceFrom: number;
  heroImage: string;
  label: string;
  itineraryJson: { day: number; theme: string; description: string }[];
};
export type JournalPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverImage: string;
  readMinutes: number;
  publishedAt: string;
  body: string;
};
export type User = {
  id: string;
  name: string;
  email: string;
  role: "TRAVELER" | "ADMIN";
};
export type PlannerInput = {
  destinationSlug: string;
  vibes: string[];
  interests: string[];
  budget: number;
  pace: "RELAXED" | "BALANCED" | "PACKED";
  days: number;
  startDate: string;
  travelers: number;
};
export type PlanItem = {
  time: string;
  title: string;
  type: "poi" | "experience" | "meal" | "transit";
  lat: number;
  lng: number;
  notes: string;
  sourceId?: string;
};
export type Itinerary = {
  title: string;
  days: { day: number; theme: string; items: PlanItem[] }[];
  estimatedBudget: { currency: string; min: number; max: number };
  tips: string[];
  sources: { id: string; title: string; text: string }[];
  mode: "ai" | "curated";
};
export type SavedPlan = {
  id: string;
  title: string;
  inputJson: PlannerInput;
  planJson: Itinerary;
  createdAt: string;
};
export type Booking = {
  id: string;
  packageId?: string;
  planId?: string;
  title: string;
  email: string;
  startDate: string;
  guests: number;
  status: "INQUIRY" | "CONFIRMED" | "CANCELLED";
  totalEstimate: number;
  notes?: string;
  createdAt: string;
  payment?: Payment | null;
};
export type Payment = {
  id: string;
  bookingId: string;
  userId: string;
  amountCents: number;
  currency: string;
  status:
    | "PENDING"
    | "PROCESSING"
    | "PAID"
    | "FAILED"
    | "EXPIRED"
    | "REFUND_PENDING"
    | "REFUNDED";
  receiptUrl?: string;
  refundId?: string;
  refundedAmountCents: number;
  livemode: boolean;
  createdAt: string;
};
export type Catalog = {
  destinations: Destination[];
  pois: Poi[];
  experiences: Experience[];
  packages: Trip[];
  journal: JournalPost[];
};
