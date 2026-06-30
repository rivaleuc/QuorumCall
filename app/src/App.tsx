import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  Megaphone, Wallet, Loader2, Plus, UserCheck, CheckCircle2, XCircle, ChevronDown, Zap,
} from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

type Log = { by: string; eligible: boolean; reason: string }
type Petition = { id: string; creator: string; action: string; eligibility: string; threshold: number; state: string; endorsers: string[]; log: Log[]; verified: number }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_petitions: 0, passed: 0, endorsements: 0 })
  const [petitions, setPetitions] = useState<Petition[]>([])
  const [open, setOpen] = useState(false); const [exp, setExp] = useState<string | null>(null)
  const [action, setAction] = useState(''); const [elig, setElig] = useState(''); const [thr, setThr] = useState('3')
  const [evUrl, setEvUrl] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_petitions: Number(s?.total_petitions ?? 0), passed: Number(s?.passed ?? 0), endorsements: Number(s?.endorsements ?? 0) })
      const total = Number(s?.total_petitions ?? 0); const out: Petition[] = []
      for (let i = total - 1; i >= 0 && i >= total - 12; i--) { try { const p = (await read('get_petition', [String(i)])) as any; if (p?.exists) out.push({ ...p, id: String(i), endorsers: p.endorsers ?? [], log: p.log ?? [] }) } catch {} }
      setPetitions(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function openP() { if (!action.trim() || !elig.trim()) return toast.error('Action + eligibility.'); const t = Number(thr); if (!(t >= 1)) return toast.error('Threshold ≥ 1'); setCreating(true); const to = toast.loading('Opening petition…'); try { await write('open_petition', [action.trim(), elig.trim(), Math.round(t)]); toast.success('Petition open.', { id: to }); setAction(''); setElig(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: to }) } finally { setCreating(false) } }
  async function endorse(p: Petition) { const u = evUrl[p.id]; if (!u?.trim()) return toast.error('Evidence URL of your eligibility.'); setBusy(p.id); const to = toast.loading('Validators verifying your eligibility… (30–60s)'); try { const out = (await write('endorse', [p.id, u.trim()])) as any; setEvUrl({ ...evUrl, [p.id]: '' }); toast.success('Endorsement recorded.', { id: to }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: to }) } finally { setBusy(null) } }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(720px_circle_at_50%_-5%,#fb71851c,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2.5 px-5">
          <Megaphone className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">QuorumCall</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_petitions} /></b> petitions · <b className="text-accent"><NumberTicker value={stats.passed} /></b> passed</div>
          <Button size="sm" className="ml-auto" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Petitions that fire on verified quorum</h1>
        <p className="mt-1 text-sm text-muted">Each endorsement is checked for eligibility by consensus — only verified, unique backers count toward the threshold.</p>

        <div className="mt-5"><Button onClick={() => setOpen(!open)} variant={open ? 'ghost' : 'primary'}><Plus className="h-4 w-4" />{open ? 'Cancel' : 'Open a petition'}</Button></div>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card/60 p-3">
              <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action to trigger when quorum is reached" className="rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <div className="flex gap-2"><input value={elig} onChange={(e) => setElig(e.target.value)} placeholder="Eligibility criterion endorsers must meet" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" /><div className="relative w-24"><input value={thr} onChange={(e) => setThr(e.target.value)} className="w-full rounded-md border border-border bg-background/70 px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary/50" /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-accent">votes</span></div><Button size="sm" onClick={openP} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />} Open</Button></div>
            </div>
          </motion.div>
        )}

        <div className="mt-6 space-y-2">
          {petitions.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">No petitions yet.</div>}
          {petitions.map((p) => {
            const passed = p.state === 'passed'; const pct = Math.min(100, (p.verified / Math.max(1, p.threshold)) * 100)
            const u = evUrl[p.id] ?? ''
            return (
              <div key={p.id} className={`rounded-xl border ${passed ? 'border-accent/40 bg-accent/[0.05]' : 'border-border bg-card/50'}`}>
                <button onClick={() => setExp(exp === p.id ? null : p.id)} className="w-full px-4 py-3 text-left">
                  <div className="flex items-center gap-2">
                    {passed ? <Zap className="h-4 w-4 shrink-0 text-accent" /> : <Megaphone className="h-4 w-4 shrink-0 text-primary" />}
                    <span className="flex-1 truncate text-sm font-medium">{p.action}</span>
                    <span className={`font-mono text-xs ${passed ? 'text-accent' : 'text-muted'}`}>{p.verified}/{p.threshold}</span>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${exp === p.id ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border"><div className={`h-full ${passed ? 'bg-accent' : 'bg-primary'}`} style={{ width: `${pct}%` }} /></div>
                </button>
                <AnimatePresence>
                  {exp === p.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-border/60">
                      <div className="space-y-3 p-4">
                        <div className="text-xs text-muted"><span className="text-primary">eligibility:</span> {p.eligibility}</div>
                        {passed && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold uppercase text-accent">Quorum reached — action triggered</div>}
                        {p.log.length > 0 && (
                          <div className="space-y-1">
                            {p.log.map((g, i) => <div key={i} className="flex items-center gap-1.5 text-[11px]">{g.eligible ? <CheckCircle2 className="h-3 w-3 text-true" /> : <XCircle className="h-3 w-3 text-false" />}<span className="font-mono text-muted">{short(g.by)}</span><span className="truncate text-muted/80">{g.reason}</span></div>)}
                          </div>
                        )}
                        {!passed && (
                          <div className="flex gap-2"><input value={u} onChange={(e) => setEvUrl({ ...evUrl, [p.id]: e.target.value })} placeholder="Evidence URL proving you're eligible" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><Button size="sm" disabled={busy === p.id} onClick={() => endorse(p)}>{busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Endorse</Button></div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </main>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6 text-xs text-muted"><span>QuorumCall · verified-endorsement quorum triggers on GenLayer</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
