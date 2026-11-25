import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import GoogleLogin from "../features/auth/GoogleLogin";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleEmailFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.error("Please use 'Continue with Google' above to sign in.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-[400px] bg-white border border-slate-200 rounded-2xl p-9 shadow-sm flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-slate-900 text-center tracking-tight">
          Login
        </h1>

        <GoogleLogin />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">or sign up through email</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleEmailFormSubmit} className="flex flex-col gap-3.5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email ID"
            className="w-full bg-slate-100 text-slate-800 placeholder:text-slate-400 text-sm rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-slate-100 text-slate-800 placeholder:text-slate-400 text-sm rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            className="w-full mt-1 bg-[#00A83F] hover:bg-[#009236] text-white font-semibold text-sm py-3 rounded-lg transition cursor-pointer"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
