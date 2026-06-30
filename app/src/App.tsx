import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Wallet, Loader2, Plus, UserCheck, Zap, Check, X } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
type Log = { by: string; eligible: boolean; reason: string }
type Petition = { id: string; action: string; eligibility: string; threshold: number; state: string; endorsers: string[]; log: Log[]; verified: number }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_petitions: 0, passed: 0, endorsements: 0 })
  const [pets, setPets] = useState<Petition[]>([]); const [sel, setSel] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState(''); const [elig, setElig] = useState(''); const [thr, setThr] = useState('3'); const [evUrl, setEvUrl] = useState('')
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_petitions: Number(s?.total_petitions ?? 0), passed: Number(s?.passed ?? 0), endorsements: Number(s?.endorsements ?? 0) })
      const total = Number(s?.total_petitions ?? 0); const out: Petition[] = []
      for (let i = total - 1; i >= 0 && i >= total - 16; i--) { try { const p = (await read('get_petition', [String(i)])) as any; if (p?.exists) out.push({ ...p, id: String(i), endorsers: p.endorsers ?? [], log: p.log ?? [] }) } catch {} }
      setPets(out); if (!sel && out.length) setSel(out[0].id)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function openP() { if (!action.trim() || !elig.trim()) return toast.error('Action + eligibility.'); if (!(Number(thr) >= 1)) return toast.error('Threshold ≥ 1'); setCreating(true); const t = toast.loading('Opening…'); try { const id = (await write('open_petition', [action.trim(), elig.trim(), Math.round(Number(thr))])) as any; toast.success('Open.', { id: t }); setAction(''); setElig(''); setOpen(false); await load(); if (typeof id === 'string') setSel(id) } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function endorse(p: Petition) { if (!evUrl.trim()) return toast.error('Evidence URL.'); setBusy(p.id); const t = toast.loading('Verifying eligibility… (30–60s)'); try { await write('endorse', [p.id, evUrl.trim()]); setEvUrl(''); toast.success('Endorsed.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  const p = pets.find((x) => x.id === sel) || null
  const pct = p ? Math.min(100, (p.verified / Math.max(1, p.threshold)) * 100) : 0
  const C = 2 * Math.PI * 70; const passed = p?.state === 'passed'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1000px_circle_at_50%_0%,#fb718524,transparent_55%)]" />
      {/* corner brand + connect — no top bar */}
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-sm font-black uppercase tracking-[0.2em] text-primary">✊ QuorumCall</span>
        <button onClick={connect} className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary">{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'connected' : 'connect'}</button>
      </div>

      {!p ? <div className="grid min-h-[70vh] place-items-center text-sm text-muted">No petitions yet — <button onClick={() => setOpen(true)} className="ml-1 text-primary underline">open one</button>.</div> : (
        <main className="mx-auto max-w-3xl px-5 pb-16 pt-6 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.35em] text-muted">{passed ? 'quorum reached' : 'gather the quorum'}</div>
          <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-black uppercase leading-[1.05] tracking-tight md:text-6xl">{p.action}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted">Eligible: {p.eligibility}</p>

          {/* giant ring */}
          <div className="relative mx-auto mt-8 h-52 w-52">
            <svg viewBox="0 0 168 168" className="h-full w-full -rotate-90"><circle cx="84" cy="84" r="70" fill="none" stroke="#ffffff12" strokeWidth="12" /><motion.circle cx="84" cy="84" r="70" fill="none" stroke={passed ? '#fbbf24' : '#fb7185'} strokeWidth="12" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct / 100) }} transition={{ duration: .8 }} /></svg>
            <div className="absolute inset-0 grid place-items-center"><div><div className="text-6xl font-black tabular-nums" style={{ color: passed ? '#fbbf24' : '#fb7185' }}>{p.verified}</div><div className="text-sm text-muted">of {p.threshold} verified</div></div></div>
          </div>
          {passed && <div className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-black uppercase text-background"><Zap className="h-4 w-4" /> passed · triggered</div>}

          {/* signer wall */}
          <div className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-2">
            {p.log.map((g, i) => <div key={i} title={g.reason} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${g.eligible ? 'border-true/40 bg-true/10 text-true' : 'border-false/30 text-false/70'}`}>{g.eligible ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}<span className="font-mono">{short(g.by)}</span></div>)}
          </div>

          {!passed && (
            <div className="mx-auto mt-8 flex max-w-md gap-2">
              <input value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder="Evidence you're eligible (URL)" className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary/60" />
              <Button disabled={busy === p.id} onClick={() => endorse(p)}>{busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Sign</Button>
            </div>
          )}

          {/* other petitions + new */}
          <div className="mt-10 flex flex-wrap justify-center gap-2 border-t border-border pt-6">
            {pets.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className={`max-w-[200px] truncate rounded-full px-3 py-1 text-xs ${sel === x.id ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground'}`}>{x.action}</button>)}
            <button onClick={() => setOpen(!open)} className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted hover:text-primary"><Plus className="inline h-3 w-3" /> petition</button>
          </div>
          {open && (
            <div className="mx-auto mt-4 grid max-w-md gap-2 rounded-xl border border-border bg-card p-3 text-left">
              <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action to trigger" className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60" />
              <div className="flex gap-2"><input value={elig} onChange={(e) => setElig(e.target.value)} placeholder="Eligibility" className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60" /><input value={thr} onChange={(e) => setThr(e.target.value)} className="w-16 rounded-md border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-primary/60" /><Button size="sm" onClick={openP} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open'}</Button></div>
            </div>
          )}
          <div className="mt-8 text-[11px] text-muted"><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div>
        </main>
      )}
    </div>
  )
}
