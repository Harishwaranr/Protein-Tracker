"use client";

import { useState } from "react";
import { Activity, ArrowRight, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/surpabase";

type Props = { onAuthenticated: () => void; onCancel?: () => void };

export default function AuthPanel({ onAuthenticated, onCancel }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signUpError) throw signUpError;
        if (data.session) {
          onAuthenticated();
        } else {
          setMode("signin");
          setMessage("Account created. Check your email to confirm it, then sign in.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        onAuthenticated();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="grid min-h-screen place-items-center bg-[#f6f8f6] px-4 py-10">
    <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-white"><Activity size={20}/></div><div className="font-extrabold tracking-widest">PROTRACK</div></div>
      <h1 className="mt-8 text-2xl font-extrabold">{mode === "signin" ? "Sign in" : "Create your account"}</h1>
      <p className="mt-2 text-sm text-gray-600">Your food logs and challenge history are saved to your account.</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-xs font-bold text-gray-700">Email<input autoComplete="email" className="input mt-2" type="email" value={email} onChange={event => setEmail(event.target.value)} required/></label>
        <label className="block text-xs font-bold text-gray-700">Password<input autoComplete={mode === "signin" ? "current-password" : "new-password"} className="input mt-2" type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required/></label>
        {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
        <button disabled={busy} className="btn btn-primary w-full" type="submit">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <ArrowRight size={16}/>} {mode === "signin" ? "Sign in" : "Create account"}</button>
      </form>
      <button className="mt-5 w-full text-sm font-bold text-emerald-800" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>
        {mode === "signin" ? "New to PROTRACK? Create an account" : "Already have an account? Sign in"}
      </button>
      {onCancel && <button className="mt-3 w-full text-sm font-semibold text-gray-500" onClick={onCancel}>Return to dashboard</button>}
    </section>
  </main>;
}