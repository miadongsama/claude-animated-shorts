# Every sound effect + ambience bed of the molasses short as a cue list timed to the picture (timeline.py), rendered
# into one stereo SFX stem. Levels follow the user's standard mix: each EVENT has a "naive" level (LU relative to the
# voice stem, measured as the event's max momentary loudness) and is placed SFX_DB = -6 dB under it; ambience BEDS
# (integrated loudness) are not reduced. All synthesized here (numpy/scipy), nothing sampled.
import math
import numpy as np
from dsp import (SR, ns, tt, rng, dbg, lp, hp, bp, peq, pan, st, place, fades, make_ir, convolve_st, momentary_max, integrated,
                 colored, smooth_noise, modal)
import sfx_gen as G
import timeline as T

N = ns(T.DUR)
SFX_DB = -6.0


class Cue:
    def __init__(self, t, name, desc, gen, naive, kind="event", p=0.0, extra=0.0, lpf=None, send=0.12, group=None):
        self.t, self.name, self.desc, self.gen, self.naive = t, name, desc, gen, naive
        self.kind, self.p, self.extra, self.lpf, self.send = kind, p, extra, lpf, send
        self.group = group or name
        self.applied = naive + (SFX_DB if kind == "event" else 0.0) + extra
        self.measured = None


# ---------------------------------------------------------------- generators (new for this short)
def env_pts(n, pts):
    tm = np.arange(n) / SR
    return np.interp(tm, [p[0] for p in pts], [p[1] for p in pts])


def gull(r):
    """herring gull 'kee-ow': a glide down through a nasal harmonic stack with a little rasp"""
    d = r.uniform(0.35, 0.55)
    n = ns(d)
    tm = np.arange(n) / SR
    f = 1900 * (1 - 0.42 * (tm / d) ** 0.7) * (1 + 0.012 * np.sin(2 * np.pi * 31 * tm))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = sum(a * np.sin(k * ph) for k, a in [(1, 1.0), (2, 0.55), (3, 0.3), (4, 0.15)])
    y *= np.sin(np.pi * np.clip(tm / d, 0, 1)) ** 0.6 * (1 + 0.25 * colored(n, r, 1.0))
    return bp(y, 900, 6000, 1) * 0.5


def gulls(dur, r, density=0.35):
    out = np.zeros((2, ns(dur)))
    t = r.uniform(0.2, 1.5)
    while t < dur - 0.6:
        g = gull(r) * r.uniform(0.3, 1.0)
        place(out, pan(lp(g, r.uniform(3000, 7000), 1), r.uniform(-0.8, 0.8)), t)
        if r.uniform() < 0.4:
            place(out, pan(gull(r) * 0.5, r.uniform(-0.8, 0.8)), t + 0.6)
        t += r.exponential(1 / density)
    return out


def harbour(dur, r, lap=1.0):
    """winter harbour air: breeze, lapping at the pilings, a far bell buoy now and then"""
    n = ns(dur)
    x = G.breeze(dur, r, 0.9, 0.2, 700)
    lapn = bp(colored(n, r, 0.6), 150, 1400, 1) * (0.5 + 0.5 * smooth_noise(n, r, 0.6)) ** 2 * lap
    x += st(lapn * 0.7)
    for k in range(int(dur / 9)):
        tb = r.uniform(0.5, dur - 2.5)
        bell = modal(2.4, [(612, 1.0, 1.6), (1530, 0.5, 1.0), (2418, 0.25, 0.6)], r) * 0.05
        place(x, pan(lp(bell, 3000, 1), r.uniform(-0.5, 0.5)), tb)
    return x


def ship_horn(dur, r):
    """steamship whistle: a breathy chord of two pipes (~180 / 228 Hz) with steam hiss, swelling and dying"""
    n = ns(dur)
    tm = np.arange(n) / SR
    y = np.zeros(n)
    for f0, a in [(176, 1.0), (223, 0.75)]:
        f = f0 * (1 + 0.004 * smooth_noise(n, r, 4.0))
        ph = 2 * np.pi * np.cumsum(f) / SR
        y += a * sum((0.7 ** k) * np.sin((k + 1) * ph) for k in range(8))
    y += 0.25 * hp(colored(n, r, 0.2), 2500, 1)
    e = env_pts(n, [(0, 0), (0.12, 0.8), (0.3, 1.0), (dur - 0.45, 0.9), (dur, 0)])
    return lp(y * e, 3500, 1) * 0.25


def rumble(dur, r, lo=40, hi=700, rate=0.5):
    """the roar of a moving mass: low band noise with slow surges"""
    n = ns(dur)
    x = bp(colored(n, r, 1.6), lo, hi, 1) * (0.6 + 0.4 * smooth_noise(n, r, rate))
    return x / (np.abs(x).max() + 1e-9)


def slurp(dur, r, depth=1.0, rate=7.0):
    """thick viscous flow: low gloopy bubbles + a sucking squelch layer"""
    n = ns(dur)
    b = G.bubbles(dur, r, rate, 70, 420, (0.03, 0.09), None, rise=(1.5, 4))
    sq = bp(colored(n, r, 1.2), 90, 900, 1) * (0.4 + 0.6 * smooth_noise(n, r, 1.3)) ** 2
    return lp(b * 0.8 + sq * 0.5 * depth, 2200, 1)


def squelch(r, big=1.0):
    """one boot sucked out of setting molasses: stretch + pop"""
    n = ns(0.55)
    tm = np.arange(n) / SR
    f = 120 + 260 * (tm / 0.55) ** 2
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-((tm - 0.3) / 0.16) ** 2) * 0.6
    y += bp(colored(n, r, 1.0), 200, 1500, 1) * np.exp(-((tm - 0.32) / 0.12) ** 2) * 0.5
    pop = modal(0.12, [(r.uniform(260, 340), 1.0, 0.03), (r.uniform(700, 900), 0.4, 0.015)], r)
    y[ns(0.42): ns(0.42) + len(pop)] += pop[: n - ns(0.42)] * 1.2
    return lp(y * big, 3000, 1)


def rustle(dur, r):
    """paper being turned: crisp crackle bursts"""
    n = ns(dur)
    x = hp(colored(n, r, 0.3), 1800, 1) * (smooth_noise(n, r, 9.0) ** 4)
    return x * env_pts(n, [(0, 0), (0.05, 1), (dur - 0.08, 0.8), (dur, 0)])


def pour(dur, r):
    """a bucket of water poured from a height into a big steel tank (lands far below)"""
    n = ns(dur)
    x = bp(colored(n, r, 0.5), 400, 4500, 1) * env_pts(n, [(0, 0), (0.08, 1), (dur - 0.25, 0.8), (dur, 0)])
    x += G.bubbles(dur, r, 26, 500, 2600, (0.006, 0.02), None) * 0.5
    return x * 0.6


def plink(r, f=None):
    """a single drop into water/molasses"""
    f = f or r.uniform(900, 1600)
    n = ns(0.18)
    tm = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * tm * (1 + 2.5 * tm)) * np.exp(-tm / 0.03)
    return y + 0.2 * hp(colored(n, r, 0.4), 3000, 1) * np.exp(-tm / 0.01)


def roller(dur, r):
    """a wet paint roller on steel: sticky swish with a soft rhythmic stroke"""
    n = ns(dur)
    x = bp(colored(n, r, 0.8), 300, 3500, 1) * (0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * np.pi * 1.4 * np.arange(n) / SR)) ** 2)
    return x * 0.5


def metal_groan(dur, r, f0=55, f1=40):
    """a huge steel tank under strain: slow stick-slip through low plate modes, a moan"""
    n = ns(dur)
    tm = np.arange(n) / SR
    plates = [(f0 * 1.0, 1.0, 0.5), (f0 * 2.3, 0.6, 0.35), (f0 * 3.9, 0.4, 0.25), (f0 * 6.1, 0.25, 0.18)]
    imp = G.stick_slip(dur, np.linspace(9, 16, n), r, 0.3)
    y = np.zeros(n)
    for f, a, d in plates:
        y += a * signal_reson(imp, f * (1 - 0.15 * tm / dur), d)
    moan = np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f1, n)) / SR) * (0.3 + 0.7 * smooth_noise(n, r, 0.7))
    return lp(y / (np.abs(y).max() + 1e-9) + 0.35 * moan, 1600, 1)


def signal_reson(x, f, decay):
    """resonator with a time-varying centre (array f) by short-block filtering"""
    out = np.zeros_like(x)
    blk = 2048
    f = np.broadcast_to(np.asarray(f, float), x.shape)
    for i in range(0, len(x), blk):
        fc = float(f[min(i + blk // 2, len(x) - 1)])
        out[i:i + blk] = bp(x[max(0, i - 512): i + blk], max(30, fc * 0.92), fc * 1.08, 1)[-len(x[i:i + blk]):]
    return out * (1 + decay)


def rivet_pop(r):
    """a rivet shearing out of a plate: sharp crack + ricochet ping + a squirt"""
    crack = hp(colored(ns(0.05), r, 0.2), 1500, 1) * np.exp(-np.arange(ns(0.05)) / SR / 0.006)
    ping = modal(0.5, [(r.uniform(2300, 2900), 1.0, 0.18), (r.uniform(5200, 6400), 0.5, 0.1)], r)
    n = ns(0.6)
    y = np.zeros(n)
    y[: len(crack)] += crack * 1.6
    y[ns(0.01): ns(0.01) + len(ping)] += ping[: n - ns(0.01)] * 0.45 * np.linspace(1, 0.6, len(ping))[: n - ns(0.01)]
    sq = bp(colored(n, r, 0.8), 600, 3000, 1) * np.exp(-np.arange(n) / SR / 0.15) * 0.4
    return y + sq


def burst(r):
    """the tank tearing open: a screaming metal rip, a deep boom, panels clanging, a rushing roar"""
    d = 3.5
    n = ns(d)
    tm = np.arange(n) / SR
    rip = hp(colored(n, r, 0.4), 700, 1) * np.exp(-tm / 0.35) * (1 + 0.5 * np.sin(2 * np.pi * 37 * tm))
    boom = np.sin(2 * np.pi * np.cumsum(55 * np.exp(-tm / 0.6) + 28) / SR) * np.exp(-tm / 0.9)
    clang = np.zeros(n)
    for k in range(6):
        c = modal(1.6, [(r.uniform(140, 260), 1.0, 0.9), (r.uniform(400, 700), 0.5, 0.6), (r.uniform(1100, 1800), 0.3, 0.3)], r)
        t0 = ns(r.uniform(0.25, 1.6))
        clang[t0: t0 + len(c)] += c[: n - t0] * r.uniform(0.3, 0.7)
    roar = rumble(d, r, 35, 600, 0.8) * env_pts(n, [(0, 0), (0.15, 1), (2.0, 0.8), (d, 0.3)])
    return st(rip * 0.9 + boom * 1.1) + pan(clang, -0.3) * 0.7 + st(roar * 0.9)


def screech(r, dur=0.9):
    """steel columns bending: a grinding screech that drops in pitch, a clank"""
    n = ns(dur)
    tm = np.arange(n) / SR
    f = 700 * (1 - 0.45 * tm / dur)
    y = sum(a * np.sin(2 * np.pi * np.cumsum(f * k) / SR) for k, a in [(1, 1.0), (2.01, 0.5), (3.03, 0.3)])
    y *= (0.5 + 0.5 * smooth_noise(n, r, 18)) * np.exp(-tm / 0.5)
    y += hp(colored(n, r, 0.3), 1200, 1) * np.exp(-tm / 0.3) * 0.4
    cl = modal(1.2, [(180, 1.0, 0.7), (470, 0.5, 0.4), (1030, 0.3, 0.2)], r)
    out = np.zeros(ns(1.4))
    out[:n] += y * 0.6
    out[ns(0.25): ns(0.25) + len(cl)] += cl[: len(out) - ns(0.25)] * 0.8
    return out


def knock(r, f=420, dur=0.35):
    """wood on wood (gavel)"""
    return modal(dur, [(f, 1.0, 0.06), (f * 2.7, 0.5, 0.03), (f * 5.1, 0.25, 0.015)], r) + 0.3 * hp(colored(ns(dur), r, 0.3), 2000, 1) * np.exp(-np.arange(ns(dur)) / SR / 0.008)


def scratch(dur, r):
    """a steel nib scratching across thick paper"""
    n = ns(dur)
    return bp(colored(n, r, 0.2), 2500, 8000, 1) * (smooth_noise(n, r, 6.0) ** 2) * 0.6


def barrel_roll(dur, r):
    """a wooden barrel rolling on cobbles: low rumble with stave knocks"""
    n = ns(dur)
    x = bp(colored(n, r, 1.4), 60, 500, 1) * 0.6
    tk = 0.0
    while tk < dur - 0.1:
        k = modal(0.12, [(r.uniform(160, 240), 1.0, 0.03), (r.uniform(500, 700), 0.4, 0.015)], r)
        i = ns(tk)
        x[i: i + len(k)] += k[: n - i] * r.uniform(0.3, 0.8)
        tk += r.uniform(0.12, 0.22)
    return x


def lid_clank(r):
    """a tin lid slammed onto a glass jar: clank + glass ring"""
    tin = modal(0.25, [(r.uniform(1800, 2200), 1.0, 0.05), (r.uniform(3900, 4500), 0.6, 0.03)], r)
    glass = modal(0.8, [(2650, 0.5, 0.35), (5300, 0.25, 0.2)], r)
    thud = modal(0.2, [(140, 1.0, 0.05)], r)
    return mixs(tin * 0.8, glass * 0.5, thud * 0.9).mean(0)


def scrape(dur, r):
    n = ns(dur)
    return bp(colored(n, r, 0.6), 400, 3000, 1) * env_pts(n, [(0, 0), (0.05, 1), (dur - 0.1, 0.7), (dur, 0)]) * 0.5


def church_bell(r):
    """one distant toll of a church bell (minor-third hum note)"""
    f = 196.0
    return modal(5.5, [(f * 0.5, 0.6, 4.0), (f, 1.0, 3.2), (f * 1.19, 0.5, 2.4), (f * 1.5, 0.35, 1.6), (f * 2.0, 0.4, 1.2), (f * 2.52, 0.2, 0.8)], r)


def clock_ticks(dur, r):
    n = ns(dur)
    y = np.zeros(n)
    t = 0.15
    k = 0
    while t < dur - 0.05:
        c = modal(0.05, [(r.uniform(3000, 3400) if k % 2 else r.uniform(2400, 2700), 1.0, 0.008)], r)
        i = ns(t)
        y[i: i + len(c)] += c[: n - i]
        t += 0.5
        k += 1
    return y


def fridge(r):
    """a heavy icebox door: latch clack, seal suction, a cold hum"""
    clack = modal(0.15, [(900, 1.0, 0.02), (2300, 0.5, 0.01)], r)
    n = ns(1.0)
    y = np.zeros(n)
    y[: len(clack)] += clack
    y += bp(colored(n, r, 0.8), 200, 1200, 1) * np.exp(-((np.arange(n) / SR - 0.12) / 0.07) ** 2) * 0.6
    y += np.sin(2 * np.pi * 60 * np.arange(n) / SR) * 0.05 * np.clip(np.arange(n) / SR / 0.3, 0, 1)
    return y


def crowd_whoa(r, voices=7, dur=0.8):
    out = np.zeros((2, ns(dur + 0.6)))
    for v in range(voices):
        w = G.whoa(r, dur=r.uniform(0.35, 0.6))
        place(out, pan(w * r.uniform(0.4, 1.0), r.uniform(-0.85, 0.85)), r.uniform(0.0, dur * 0.5))
    return out


def chatter(dur, r, voices=3, base=110):
    out = np.zeros((2, ns(dur)))
    for v in range(voices):
        b = G.babble(dur, r, base * r.uniform(0.85, 1.25), r.uniform(0.95, 1.08), rate=r.uniform(3.6, 4.6), active=0.55)
        place(out, pan(b * r.uniform(0.5, 1.0), r.uniform(-0.6, 0.6)), 0.0)
    return out


def footsteps(dur, r, rate=2.0, scuff=0.5, people=1):
    out = np.zeros((2, ns(dur)))
    for pp in range(people):
        t = r.uniform(0, 0.3)
        p = r.uniform(-0.6, 0.6)
        while t < dur - 0.1:
            place(out, pan(G.stroll_step(r, scuff) * r.uniform(0.6, 1.0), p), t)
            t += 1 / rate * r.uniform(0.92, 1.08)
    return out


def mixs(*xs):
    """sum mono/stereo signals of different lengths (padded at the end)"""
    xs = [st(np.asarray(x, float)) for x in xs]
    n = max(x.shape[1] for x in xs)
    out = np.zeros((2, n))
    for x in xs:
        out[:, : x.shape[1]] += x
    return out


def _fit(x, dur, fi=0.05, fo=0.1):
    x = np.asarray(x, float)
    n = ns(dur)
    if x.ndim == 1:
        x = x[:n] if len(x) >= n else np.pad(x, (0, n - len(x)))
    else:
        x = x[:, :n] if x.shape[1] >= n else np.pad(x, ((0, 0), (0, n - x.shape[1])))
    return fades(x, fi, fo)


# ---------------------------------------------------------------- the cue list
def cues():
    C = []
    R = rng(1919)
    rr = lambda: rng(int(R.integers(1 << 30)))
    add = C.append
    s = T.shot_t

    # ------------------------------------------------ beds (not reduced by the -6 dB event rule)
    add(Cue(0.0, "bed_wave_hook", "hook: the wave's roar right behind the runners, gloopy surge, running crowd (shot 1)",
            lambda r=rr(): (_fit(st(rumble(5.9, r, 35, 650, 0.9)) * 1.0 + st(slurp(5.9, r, 1.0, 9)) * 0.5 + footsteps(5.9, r, 5.0, 1.0, 4) * 0.35, 5.87, 0.02, 0.03), 0.0), -18, "bed", send=0.0))
    add(Cue(T.FLASH, "bed_harbour", "winter harbour: breeze, lapping at the pilings, gulls, a far bell buoy (shots 2-8)",
            lambda r=rr(): (_fit(harbour(s(8)[1] - T.FLASH + 0.2, r) + gulls(s(8)[1] - T.FLASH + 0.2, r, 0.3) * 0.5, s(8)[1] - T.FLASH + 0.2, 0.3, 0.2), 0.0), -27, "bed", send=0.0))
    add(Cue(T.FLASH, "bed_city", "Commercial Street 1919: far horse hooves, cart wheels, a murmur (shots 2-3)",
            lambda r=rr(): (_fit(chatter(8.6, r, 4, 120) * 0.25 + footsteps(8.6, r, 2.6, 0.2, 2) * 0.3, 8.6, 0.4, 0.6), 0.0), -31, "bed", lpf=3200, send=0.0))
    add(Cue(T.BURST - 0.1, "bed_flood", "the flood rolling out: roar + thick gloop, settling (shots 8-11)",
            lambda r=rr(): (_fit(st(rumble(13.5, r, 30, 600, 0.6)) * env_pts(ns(13.5), [(0, 0.2), (0.3, 1), (6.5, 0.7), (9.0, 0.35), (13.5, 0.3)])[None, :]
                                 + st(slurp(13.5, r, 1.0, 6)) * 0.6, 13.5, 0.05, 0.4), 0.0), -17, "bed", send=0.0))
    add(Cue(s(12)[0] - 0.13, "bed_kitchen", "kitchen: room tone, a wall clock ticking, winter wind at the window (shot 12)",
            lambda r=rr(): (_fit(st(clock_ticks(4.8, r)) * 0.35 + G.breeze(4.8, r, 0.25, 0.3, 500), 4.8, 0.2, 0.25), 0.0), -33, "bed", send=0.0))
    add(Cue(s(13)[0] - 0.13, "bed_wave2", "the runny wave racing past (shot 13)",
            lambda r=rr(): (_fit(st(rumble(1.35, r, 40, 700, 1.2)) + st(slurp(1.35, r, 1.0, 8)) * 0.6, 1.35, 0.1, 0.35), 0.0), -18, "bed", send=0.0))
    add(Cue(s(14)[0] - 0.23, "bed_night", "the freezing night: cold wind, the harbour far off, molasses ticking as it sets (shots 14-15)",
            lambda r=rr(): (_fit(G.breeze(5.2, r, 1.0, 0.35, 450) + harbour(5.2, r, 0.4) * 0.4, 5.2, 0.4, 0.5), 0.0), -26, "bed", send=0.0))
    add(Cue(s(16)[0] - 0.13, "bed_court", "courtroom: high room tone, murmur, a chair creak (shots 16-17)",
            lambda r=rr(): (_fit(chatter(6.7, r, 6, 115) * 0.18 + G.breeze(6.7, r, 0.12, 0.1, 400), 6.7, 0.3, 0.3), 0.0), -32, "bed", lpf=2800, send=0.0))
    add(Cue(s(18)[0] - 0.13, "bed_street", "street by the distillery and the saloon: far hooves, chatter (shots 18-19)",
            lambda r=rr(): (_fit(chatter(4.5, r, 4, 120) * 0.25 + G.breeze(4.5, r, 0.4, 0.2, 700), 4.5, 0.25, 0.3), 0.0), -30, "bed", lpf=3400, send=0.0))
    add(Cue(s(20)[0] - 0.13, "bed_kitchen2", "kitchen in January: clock, wind at the window (shot 20)",
            lambda r=rr(): (_fit(st(clock_ticks(5.1, r)) * 0.35 + G.breeze(5.1, r, 0.3, 0.3, 500), 5.1, 0.25, 0.4), 0.0), -33, "bed", send=0.0))

    # ------------------------------------------------ hook (shot 1)
    add(Cue(1.2, "whoa_hook", "a few startled 'whoa!'s from the people running", lambda r=rr(): (crowd_whoa(r, 5, 0.7), 0.0), -14, lpf=5200, send=0.2))
    add(Cue(T.FLASH, "flash", "reverse swell into the white flash + soft low whoomp",
            lambda r=rr(): (mixs(G.whoosh(0.7, r, 0.55, 300, 2400, 0.9, 0.15, 0.2), modal(0.6, [(55, 1.0, 0.25)], r) * 0.6), 0.55), -6, send=0.15))

    # ------------------------------------------------ the setup (shots 2-7)
    for f, d in [(230, "cut to the tank"), (258, "cut low under the wall"), (292, "crane up the side"), (544, "cut to the painters"), (708, "cut to the roofs"),
                 (767, "cut to the groaning wall"), (842, "whip to the rivets"), (958, "cut low"), (1000, "race alongside"), (1532, "push in")]:
        add(Cue(T.fr(f), "whoosh", f"camera: {d}", (lambda r=rr(): (G.whoosh(0.55, r, 0.09, 330, 2000, 0.8, 0.16, 0.15), 0.09)), -13, send=0.1))
    add(Cue(T.fr(398), "rustle", "Jell turns the blueprint round (and round)", lambda r=rr(): (rustle(0.55, r), 0.0), -12, p=-0.1))
    add(Cue(T.fr(446), "pour", "one bucket of water tipped into the empty tank, splashing far below (with the tank's echo)",
            lambda r=rr(): (convolve_st(pour(1.1, r), make_ir(2.4, 12, pre=0.03, hf=1.0)) * 0.6 + st(pour(1.1, r)) * 0.4, 0.0), -12, send=0.05))
    for k, tm in enumerate([16.9, 17.6, 18.3, 19.1]):
        add(Cue(tm, "drip", "molasses dripping from the seam", lambda r=rr(): (plink(r, 380 + 60 * k), 0.0), -18, p=0.1, group="drips"))
    add(Cue(T.PAINT0, "roller", "paint rollers slapping brown paint on the steel", lambda r=rr(): (roller(T.PAINT1 - T.PAINT0 + 0.2, r), 0.0), -16, p=0.2, send=0.08))
    add(Cue(T.fr(612), "kids", "kids giggling at the drips", lambda r=rr(): (chatter(1.6, r, 2, 240) * 0.8, 0.0), -16, lpf=6000, send=0.12))
    add(Cue(T.fr(668), "ship_horn", "the steamship's whistle as it tops the tank up",
            lambda r=rr(): (st(ship_horn(1.6, r)), 0.0), -10, p=-0.4, send=0.35))
    add(Cue(T.fr(684), "pump", "the hose pumping molasses up into the tank (rhythmic gloop)", lambda r=rr(): (slurp(0.9, r, 0.6, 5) * env_pts(ns(0.9), [(0, 0), (0.1, 1), (0.8, 1), (0.9, 0)]), 0.0), -18, p=-0.2))
    for k in range(9):
        add(Cue(T.fr(712) + 0.21 * k + 0.05 * math.sin(k * 3), "icicle_drip", "melt water dripping from the icicles", lambda r=rr(): (plink(r), 0.0), -20, p=0.3 * math.sin(k), group="icicles"))
    add(Cue(T.fr(767), "groan", "the tank groaning: steel plates straining, a low moan",
            lambda r=rr(): (st(metal_groan(1.75, r, 55, 42)), 0.0), -8, send=0.25))
    for k, tm in enumerate([25.9, 26.3, 26.75]):
        add(Cue(tm, "tick", "plates ticking under strain", lambda r=rr(): (modal(0.2, [(r.uniform(900, 1400), 1.0, 0.04), (r.uniform(2500, 3200), 0.4, 0.02)], r), 0.0), -16, p=0.2 * (k - 1), group="ticks"))

    # ------------------------------------------------ lunch, rivets, burst (shot 8)
    add(Cue(T.fr(819), "lunch", "workers chatting over lunch, a laugh", lambda r=rr(): (chatter(0.8, r, 3, 105), 0.0), -15, lpf=5000, send=0.15))
    for k, tm in enumerate(T.RIVETS):
        add(Cue(tm, "rivet", f"rivet {k + 1} shoots out (machine-gun rattle)", lambda r=rr(): (rivet_pop(r), 0.0), -6, p=0.15 * math.sin(k * 2), send=0.18, group="rivets"))
    add(Cue(T.BURST, "burst", "the whole tank tears open: metal rip, deep boom, panels clanging, the roar begins",
            lambda r=rr(): (burst(r), 0.0), 0, send=0.25))

    # ------------------------------------------------ the wave (shot 9)
    add(Cue(T.fr(944), "whoa_wave", "people running from the wave", lambda r=rr(): (crowd_whoa(r, 6, 0.9), 0.0), -15, lpf=4800, send=0.25))
    add(Cue(T.EL_HIT - 0.05, "el_bend", "the crest slams the el: columns screech and bend, a clank", lambda r=rr(): (st(screech(r, 0.9)), 0.0), -5, send=0.22))
    add(Cue(T.SHED_HIT - 0.03, "shed_crash", "the wooden shed flattened: splintering crash + timber boom",
            lambda r=rr(): (mixs(G.wood_crack(r), np.asarray(G.timber_tear(r, 0.6)) * 0.6), 0.0), -4, send=0.22))

    # ------------------------------------------------ luckily / unluckily (shots 10-11)
    add(Cue(T.fr(1150), "dip", "the pancake dipped in runny molasses: a happy gloop", lambda r=rr(): (slurp(0.5, r, 0.4, 10) * 0.8, 0.0), -15, p=0.1))
    add(Cue(T.fr(1209), "swept", "the flow sweeps the crate away: surge + squelchy plop", lambda r=rr(): (mixs(G.whoosh(0.6, r, 0.2, 200, 1400, 0.8, 0.2, 0.1), squelch(r, 1.3) * 0.8), 0.0), -9, send=0.12))

    # ------------------------------------------------ kitchen (shot 12)
    add(Cue(T.fr(1321), "drizzle", "warm honey drizzling onto toast", lambda r=rr(): (lp(G.bubbles(1.3, r, 9, 300, 1200, (0.02, 0.05), None), 2500, 1) * 0.5, 0.0), -19, p=0.1))
    add(Cue(T.FRIDGE, "fridge", "the icebox door: clack, seal, cold hum", lambda r=rr(): (fridge(r), 0.0), -13, p=0.3, send=0.1))
    add(Cue(T.SPOON_PULL, "stuck_spoon", "pulling the spoon: the whole jar comes along with a sticky creak",
            lambda r=rr(): (mixs(G.creak(0.45, r, 60, 110, G.WOOD, rough=0.25) * 0.6, squelch(r, 0.6)), 0.0), -13, p=-0.1))

    # ------------------------------------------------ night (shots 14-15)
    for k, tm in enumerate([51.25, 51.9, 52.45]):
        add(Cue(tm, "squelch", "a boot hauled out of set molasses on a stretching strand", lambda r=rr(): (squelch(r, 1.0), 0.0), -12, p=0.15, group="squelch"))
    add(Cue(T.fr(1585), "bell", "one toll of a church bell across the frozen street", lambda r=rr(): (st(lp(church_bell(r), 2500, 1)), 0.0), -14, send=0.5))

    # ------------------------------------------------ court (shots 16-17)
    for k, tm in enumerate(T.GAVEL):
        add(Cue(tm, "gavel", "the judge's gavel", lambda r=rr(): (knock(r, 420 if k == 0 else 380), 0.0), -6, p=0.1, send=0.3, group="gavel"))
    add(Cue(T.fr(1788), "pen", "the engineer signs: nib scratching across the plans", lambda r=rr(): (scratch(0.9, r), 0.0), -18, p=-0.2))
    add(Cue(T.fr(1814), "stamp", "the seal stamped down", lambda r=rr(): (knock(r, 210, 0.3), 0.0), -12, p=-0.2, send=0.2))

    # ------------------------------------------------ distillery, saloon (shots 18-19)
    add(Cue(T.fr(1822), "barrel", "a barrel rolled over the cobbles to the distillery door", lambda r=rr(): (barrel_roll(1.9, r), 0.0), -15, p=-0.2))
    for k, tm in enumerate(T.HAMMER):
        add(Cue(tm, "hammer", f"hammer blow {k + 1} nailing up the no-alcohol sign", lambda r=rr(): (G.hammer_hit(r, 0.9 + 0.1 * k), 0.0), -6, p=0.15, send=0.2, group="hammer"))

    # ------------------------------------------------ ending (shot 20)
    add(Cue(T.fr(1965), "slow_drip", "molasses creeping onto the pancakes (slow, thick plops)", lambda r=rr(): (mixs(*[np.pad(plink(r, 260) * 0.7, (ns(0.9 * k), 0)) for k in range(3)]), 0.0), -20, p=0.1))
    add(Cue(T.LID, "lid", "the lid slammed back on the jar", lambda r=rr(): (lid_clank(r), 0.0), -7, p=0.05, send=0.12))
    add(Cue(T.fr(2056), "slide", "the jar slid away across the table", lambda r=rr(): (scrape(0.5, r), 0.0), -16, p=-0.1))
    return C


# ================================================================ render
def render(v_ref, on_event=None):
    C = cues()
    out = np.zeros((2, N))
    send = np.zeros(N)
    for c in C:
        x, anchor = c.gen()
        x = np.asarray(x, float)
        x = pan(x, c.p) if x.ndim == 1 else x
        tgt = v_ref + c.applied
        cur = momentary_max(x) if c.kind == "event" else integrated(x)
        if np.isfinite(cur):
            x = x * dbg(tgt - cur)
        if c.lpf:
            x = lp(x, c.lpf, 1)
        c.measured = momentary_max(x) - v_ref if c.kind == "event" else integrated(x) - v_ref
        t0 = c.t - anchor
        place(out, x, t0)
        if on_event:
            on_event(c, x, t0)
        if c.send > 0:
            G._place_mono(send, c.send * x.mean(0), t0)
    street = make_ir(1.0, 77, pre=0.01, hf=1.6, early=[(0.07, 0.45, -0.5), (0.12, 0.3, 0.6), (0.2, 0.2, -0.2)])
    out += 0.5 * convolve_st(send, street)
    out = hp(out, 25, 2)
    end = ns(T.DUR - 0.12)
    out[:, end:] *= np.linspace(1, 0, N - end)[None, :] ** 2
    return out, C
