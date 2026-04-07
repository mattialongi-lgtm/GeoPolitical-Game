import React, { useState } from "react";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { User as UserIcon } from "lucide-react";
import { motion } from "motion/react";
import { supabase } from "../../lib/supabase";
import { setBackendAuthCookie } from "../../api/authClient";
import { TerritorialBrandLogo } from "../ui";
import territorialBrand from "../../assets/branding/territorial-logo.png";

const Auth = ({ onLogin }: { onLogin: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // Still needed for profile registration
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let session = null;
      if (isLogin) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        session = data.session;
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username }
          }
        });
        if (authError) throw authError;
        session = data.session;
      }
      // Explicitly set cookie before fetching data to avoid race conditions
      if (session) {
        setBackendAuthCookie(session.access_token);
      }
      onLogin();
    } catch (err: any) {
      setError(err.message || "Authentication error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message || "Google login failed");
      console.error(err);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-slate-950 p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(180,140,72,0.22),_transparent_42%),linear-gradient(180deg,_rgba(4,14,20,0.96),_rgba(2,10,16,0.98))]" />
      <div
        className="absolute inset-0 bg-center bg-no-repeat opacity-25"
        style={{ backgroundImage: `url(${territorialBrand})`, backgroundSize: "min(92vw, 58rem)" }}
      />
      <div className="absolute inset-0 bg-slate-950/45" />
      <div className="relative z-10 w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/95 backdrop-blur-sm p-8 rounded-[2rem] shadow-2xl shadow-black/60 border border-gray-700/50"
        >
          <div className="flex flex-col items-center mb-8">
            <TerritorialBrandLogo className="w-full max-w-[16rem] h-auto mb-5 drop-shadow-[0_16px_32px_rgba(2,10,16,0.28)]" />
            <p className="text-gray-400 text-sm font-medium mt-1">
              {isLogin ? "Bentornato, Comandante" : "Inizia la tua ascesa"}
            </p>
          </div>

          <div className="space-y-4">
            {true && (
              <>
                <button
                  onClick={handleGoogleLogin}
                  disabled={googleLoading || loading}
                  className="w-full flex items-center justify-center gap-3 bg-gray-800/50 border border-gray-700/40 py-3 rounded-2xl font-bold text-gray-200 hover:bg-gray-700/50 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {googleLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Continua con Google
                    </>
                  )}
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-gray-700/50"></div>
                  <span className="flex-shrink mx-4 text-gray-500 text-[10px] font-black uppercase tracking-widest">Oppure</span>
                  <div className="flex-grow border-t border-gray-700/50"></div>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-700/40 bg-gray-800/60 focus:bg-gray-800 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-medium text-gray-200 placeholder:text-gray-500"
                    placeholder="tua@email.com"
                    required
                  />
                </div>
              </div>
              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Username</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-700/40 bg-gray-800/60 focus:bg-gray-800 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-medium text-gray-200 placeholder:text-gray-500"
                      placeholder="Il tuo nome"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-700/40 bg-gray-800/60 focus:bg-gray-800 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all font-medium text-gray-200 placeholder:text-gray-500"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-rose-500 text-xs font-bold ml-1"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Accedi" : "Crea Account"}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="text-xs font-bold text-gray-400 hover:text-indigo-400 transition-colors"
            >
              {isLogin ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
            </button>
          </div>
        </motion.div>

        <p className="mt-8 text-center text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">
          Territorial &copy; 2026 • Geopolitical MVP
        </p>
      </div>
    </div>
  );
};

export default Auth;
