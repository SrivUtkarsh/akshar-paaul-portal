import { useState } from 'react';
import { BookOpenText, ClipboardCheck, Eye, EyeOff, GraduationCap, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try { await login(username, password); toast.success('Welcome back.'); }
    catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }

  return <div className="grid min-h-screen bg-paper lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden bg-forest p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
      <div className="absolute -right-28 -top-24 h-96 w-96 rounded-full border-[42px] border-white/5" />
      <div className="absolute -bottom-32 -left-28 h-96 w-96 rounded-full bg-white/5" />
      <div className="relative flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><GraduationCap size={27} /></div><div><p className="text-lg font-extrabold">Akshar Paaul</p><p className="text-sm text-white/65">Learning support portal</p></div></div>
      <div className="relative max-w-xl"><p className="mb-5 inline-flex rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-white/80">One workspace, two simple workflows</p><h1 className="text-5xl font-extrabold leading-[1.08] tracking-tight xl:text-6xl">More time for teaching. Less time on paperwork.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-white/75">Manage daily faculty updates and review student book summaries with supportive AI suggestions.</p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/15 bg-white/10 p-4"><ClipboardCheck size={22} className="mb-3 text-sun" /><p className="font-bold">Daily work review</p><p className="mt-1 text-sm text-white/70">Submit, review, approve and share feedback.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 p-4"><BookOpenText size={22} className="mb-3 text-sun" /><p className="font-bold">Book summary review</p><p className="mt-1 text-sm text-white/70">Read handwritten work with a reusable rubric.</p></div></div>
      </div>
      <p className="relative text-xs text-white/50">Designed for the Akshar Paaul education team.</p>
    </section>
    <section className="flex items-center justify-center px-5 py-12 sm:px-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest text-white"><GraduationCap /></div><div><p className="font-extrabold">Akshar Paaul</p><p className="text-xs text-slate-500">Learning support portal</p></div></div>
        <div className="mb-8"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sun/35 text-forest"><ShieldCheck size={25} /></div><p className="text-sm font-bold text-forest">Welcome</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight">Sign in to your workspace</h2><p className="mt-2 text-sm leading-6 text-slate-500">Use the account provided by your administrator.</p></div>
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-7">
          <div><label className="label" htmlFor="username">Username</label><input id="username" className="field" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required placeholder="Enter your username" /></div>
          <div><label className="label" htmlFor="password">Password</label><div className="relative"><input id="password" type={showPassword ? 'text' : 'password'} className="field pr-12" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="text-center text-xs leading-5 text-slate-400">Student page images are sent to the configured Groq API for AI-assisted review. A teacher makes the final assessment.</p>
        </form>
      </div>
    </section>
  </div>;
}
