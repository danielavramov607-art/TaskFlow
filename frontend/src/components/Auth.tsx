import React, { useState, useEffect } from "react";
import { useMutation } from "@apollo/client/react";
import { LOGIN, REGISTER } from "../gql";

interface Props {
  onLogin: (token: string) => void;
}

export default function Auth({ onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");

  const [login, { loading: loginLoading }] = useMutation(LOGIN);
  const [register, { loading: registerLoading }] = useMutation(REGISTER);

  const loading = loginLoading || registerLoading;

  // Pick up token from URL after Google OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const err = params.get("error");
    if (token) {
      window.history.replaceState({}, "", window.location.pathname);
      onLogin(token);
    }
    if (err) setError("Google sign-in failed. Please try again.");
  }, [onLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        const { data } = await login({ variables: { email: form.email, password: form.password } });
        onLogin((data as any).login.token);
      } else {
        const { data } = await register({ variables: form });
        onLogin((data as any).register.token);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>TaskFlow</h1>
        <p style={styles.sub}>Real-time collaborative task boards</p>

        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(mode === "login" ? styles.activeTab : {}) }} onClick={() => setMode("login")}>Login</button>
          <button style={{ ...styles.tab, ...(mode === "register" ? styles.activeTab : {}) }} onClick={() => setMode("register")}>Register</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "register" && (
            <input style={styles.input} placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          )}
          <input style={styles.input} type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <input style={styles.input} type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>or</span>
        </div>

        <a href="http://localhost:4000/auth/google" style={styles.googleBtn}>
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </a>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" },
  card: { background: "#111", border: "1px solid #222", borderRadius: 16, padding: 40, width: 360 },
  logo: { color: "#22d3ee", margin: 0, fontSize: 28, fontWeight: 700 },
  sub: { color: "#666", marginTop: 6, marginBottom: 24, fontSize: 14 },
  tabs: { display: "flex", gap: 8, marginBottom: 24 },
  tab: { flex: 1, padding: "8px 0", background: "transparent", border: "1px solid #333", borderRadius: 8, color: "#888", cursor: "pointer", fontSize: 14 },
  activeTab: { background: "#22d3ee22", borderColor: "#22d3ee", color: "#22d3ee" },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  input: { padding: "10px 14px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#eee", fontSize: 14, outline: "none" },
  btn: { padding: "12px 0", background: "#22d3ee", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 4 },
  error: { color: "#f87171", fontSize: 13, margin: 0 },
  divider: { display: "flex", alignItems: "center", margin: "20px 0", gap: 12 },
  dividerText: { color: "#444", fontSize: 13, whiteSpace: "nowrap" as const, flex: 1, textAlign: "center" as const, borderTop: "1px solid #222", paddingTop: 0, lineHeight: 0, position: "relative" as const },
  googleBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "11px 0", background: "#fff", border: "none", borderRadius: 8, color: "#333", fontWeight: 600, fontSize: 14, cursor: "pointer", textDecoration: "none", boxSizing: "border-box" as const },
};
