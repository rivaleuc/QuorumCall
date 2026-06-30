import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Megaphone, Wallet, Loader2, Plus, UserCheck, Zap, Check, X } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

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
  async function endorse(p: Petition) { if (!evUrl.trim()) return toast.error('Evidence URL.'); setBusy(p.id); const t = toast.loading('Verifying eligibility… (30–60s)'); try { await write('endorse', [p.id, evUrl.trim()]); setEvUrl(''); toast.success('Endorsement recorded.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  const p = pets.find((x) => x.id === sel) || null
  const pct = p ? Math.min(100, (p.verified / Math.max(1, p.threshold)) * 100) : 0
  const C = 2 * Math.PI * 52; const passed = p?.state === 'passed'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_circle_at_50%_-10%,#fb71851c,transparent_60%)]" />
      <header className="border-b border-border"><div className="mx-auto flex h-16 max-w-5xl items-center gap-2.5 px-5">
        <Megaphone className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">QuorumCall</span>
        <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_petitions} /></b> petitions · <b className="text-accent"><NumberTicker value={stats.passed} /></b> passed</div>
        <Button size="sm" className="ml-auto" variant="outline" onClick={() => setOpen(!open)}><Plus className="h-4 w-4" /> Petition</Button>
        <Button size="sm" className="ml-2" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
      </div></header>

      <div className="mx-auto max-w-5xl px-5 pt-5">
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card/60 p-3">
              <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action to trigger at quorum" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <div className="flex gap-2"><input value={elig} onChange={(e) => setElig(e.target.value)} placeholder="Eligibility criterion" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><div className="relative w-24"><input value={thr} onChange={(e) => setThr(e.target.value)} className="w-full rounded-md border border-border bg-background/70 px-3 py-2 pr-10 text-sm outline-none focus:border-primary/50" /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-accent">need</span></div><Button size="sm" onClick={openP} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />} Open</Button></div>
            </div>
          </motion.div>
        )}
        <div className="flex flex-wrap gap-2">{pets.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className={`max-w-[200px] truncate rounded-lg border px-3 py-1.5 text-xs ${sel === x.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-foreground'}`}>{x.action}</button>)}</div>
      </div>

      {!p ? <div className="mx-auto max-w-5xl px-5 py-24 text-center text-sm text-muted">No petitions yet.</div> : (
        <main className="mx-auto grid max-w-5xl gap-6 px-5 py-7 md:grid-cols-[260px_1fr]">
          {/* ring gauge */}
          <div className="flex flex-col items-center">
            <div className="relative h-40 w-40">
              <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90"><circle cx="64" cy="64" r="52" fill="none" stroke="#ffffff10" strokeWidth="10" /><motion.circle cx="64" cy="64" r="52" fill="none" stroke={passed ? '#fbbf24' : '#fb7185'} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct / 100) }} transition={{ duration: .8 }} /></svg>
              <div className="absolute inset-0 grid place-items-center text-center"><div><div className="text-4xl font-black tabular-nums" style={{ color: passed ? '#fbbf24' : '#fb7185' }}>{p.verified}</div><div className="text-xs text-muted">of {p.threshold}</div></div></div>
            </div>
            {passed ? <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-bold uppercase text-accent"><Zap className="h-3.5 w-3.5" /> passed · triggered</div> : <div className="mt-3 text-xs text-muted">gathering quorum…</div>}
          </div>

          {/* action + signer wall */}
          <div>
            <h1 className="text-2xl font-black tracking-tight">{p.action}</h1>
            <div className="mt-1 text-sm text-muted"><span className="text-primary">eligibility:</span> {p.eligibility}</div>

            <div className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted">Signer wall</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.log.length === 0 && <span className="text-sm text-muted">No endorsements yet.</span>}
              {p.log.map((g, i) => (
                <div key={i} title={`${short(g.by)} · ${g.reason}`} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${g.eligible ? 'border-true/40 bg-true/10 text-true' : 'border-false/30 bg-false/5 text-false/80'}`}>
                  {g.eligible ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}<span className="font-mono">{short(g.by)}</span>
                </div>
              ))}
            </div>

            {!passed && (
              <div className="mt-5 flex gap-2">
                <input value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder="Evidence URL proving you're eligible" className="min-w-0 flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
                <Button disabled={busy === p.id} onClick={() => endorse(p)}>{busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Endorse</Button>
              </div>
            )}
          </div>
        </main>
      )}
      <footer className="border-t border-border"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-xs text-muted"><span>QuorumCall · verified-endorsement quorum triggers</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
