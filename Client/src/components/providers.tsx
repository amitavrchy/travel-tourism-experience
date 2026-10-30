"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Check, Compass, Eye, EyeOff, LoaderCircle, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, ApiError, json } from "@/lib/api";
import { catalog } from "@/lib/catalog";
import type { Catalog, User } from "@/lib/types";
import { makeStore } from "@/features/planner/plannerSlice";

type AppContext = { user: User | null; authLoading: boolean; openAuth: () => void; logout: () => Promise<void>; toast: (message: string) => void };
const Context = createContext<AppContext | null>(null);
export function useApp() { const context = useContext(Context); if (!context) throw new Error("Missing app provider"); return context; }
export function useCatalog() { return useQuery({ queryKey: ["catalog"], queryFn: () => api<Catalog>("catalog"), initialData: catalog, staleTime: 30000, retry: 1 }); }

const authSchema = z.object({ name: z.string().max(80).optional(), email: z.email("Enter a valid email address."), password: z.string().min(8, "Use at least 8 characters.").max(72) });
type AuthForm = z.infer<typeof authSchema>;

export function Dialog({ children, title, onClose, wide = false }: { children: React.ReactNode; title: string; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = ref.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]') || []);
    focusable()[0]?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const elements = focusable(); const first = elements[0]; const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, [onClose]);
  return <motion.div className="dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`dialog ${wide ? "dialog-wide" : ""}`} initial={{ y: 18, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10 }}>
      <button className="icon-button dialog-close" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>{children}
    </motion.div>
  </motion.div>;
}

function AppState({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: async () => { try { return await api<User>("auth/me"); } catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error; } }, retry: false, staleTime: 300000 });
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [notice, setNotice] = useState("");
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const form = useForm<AuthForm>({ resolver: zodResolver(authSchema), defaultValues: { name: "", email: "", password: "" } });
  const toast = useCallback((message: string) => { setNotice(message); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setNotice(""), 5000); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);
  const submit = form.handleSubmit(async values => {
    if (mode === "register" && (!values.name || values.name.trim().length < 2)) { form.setError("name", { message: "Tell us your name (at least 2 characters)." }); return; }
    setServerError("");
    try {
      const result = await api<{ user: User }>(`auth/${mode}`, json("POST", values));
      client.setQueryData(["session"], result.user);
      await client.invalidateQueries({ queryKey: ["bookings"] });
      await client.invalidateQueries({ queryKey: ["plans"] });
      setAuthOpen(false); form.reset(); toast(`Welcome${mode === "login" ? " back" : " aboard"}, ${result.user.name.split(" ")[0]}.`);
    } catch (error) { setServerError((error as Error).message); }
  });
  const logout = async () => {
    try { await api("auth/logout", json("POST")); client.setQueryData(["session"], null); client.removeQueries({ queryKey: ["bookings"] }); client.removeQueries({ queryKey: ["plans"] }); toast("You’re signed out. See you on the next journey."); }
    catch (error) { toast((error as Error).message); }
  };
  return <Context.Provider value={{ user: session.data || null, authLoading: session.isPending, openAuth: () => { setServerError(""); setAuthOpen(true); }, logout, toast }}>
    {children}
    <AnimatePresence>{authOpen && <Dialog title={mode === "login" ? "Welcome back" : "Join Wanderline"} onClose={closeAuth}>
      <Compass className="auth-symbol" size={36} strokeWidth={1.3} /><p className="eyebrow">YOUR NEXT CHAPTER</p><h2>{mode === "login" ? "Good to see you again." : "A world of possibility."}</h2><p className="muted">Save your ideas. Make them happen. Travel your way.</p>
      <form onSubmit={submit} className="stack-form">
        {mode === "register" && <label>Your name<input autoComplete="name" placeholder="Alex Morgan" {...form.register("name")} />{form.formState.errors.name && <span className="field-error">{form.formState.errors.name.message}</span>}</label>}
        <label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" {...form.register("email")} />{form.formState.errors.email && <span className="field-error">{form.formState.errors.email.message}</span>}</label>
        <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" {...form.register("password")} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{form.formState.errors.password && <span className="field-error">{form.formState.errors.password.message}</span>}</label>
        {serverError && <p role="alert" className="error-message">{serverError}</p>}
        <button className="button button-dark" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <LoaderCircle className="spin" size={18} /> : null}{mode === "login" ? "Sign in" : "Create your account"}</button>
      </form>
      <p className="auth-switch">{mode === "login" ? "New around here?" : "Already part of the journey?"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setServerError(""); form.clearErrors(); }}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>
    </Dialog>}</AnimatePresence>
    <AnimatePresence>{notice && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}><Check size={18} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={16} /></button></motion.div>}</AnimatePresence>
  </Context.Provider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  const [store] = useState(makeStore);
  return <Provider store={store}><QueryClientProvider client={client}><MotionConfig reducedMotion="user"><AppState>{children}</AppState></MotionConfig></QueryClientProvider></Provider>;
}
