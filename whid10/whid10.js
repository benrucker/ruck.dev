// whid10 portfolio page. Vanilla ports of the museum's motion: logo swap,
// messages shapes, holographic ticket, bots petals, gamers reveal, OC
// character reveal. The You exhibit's vortex lives in whid10-vortex.js.
(() => {
  "use strict";

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Runs `fn(visible)` whenever `el` enters or leaves the viewport.
  function onVisibility(el, fn, options) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => fn(e.isIntersecting, e)),
      options,
    );
    io.observe(el);
    return io;
  }

  /* ---------------------------------------------------------------------
     Sticky nav: mark the section in view.
     --------------------------------------------------------------------- */
  (() => {
    const links = [...document.querySelectorAll(".stamp-nav a[href^='#']")];
    const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          links.forEach((a) => a.removeAttribute("aria-current"));
          byId.get(entry.target.id)?.setAttribute("aria-current", "true");
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => io.observe(s));
  })();

  /* ---------------------------------------------------------------------
     Front door: logo swap (AnimatedHomepageLogo*.tsx). The main logo idles
     for 4–6 s, then bursts through seven exhibit logos at 100–150 ms each
     before settling back. Every hop is a 100 ms swap: the visible slot
     drops out of frame (translateY 200px, stretched, blurred) while the
     next slot rises in from 25px below; opacity snaps in two steps so the
     two never blend. Three stacked slots: the main SVG and two <img>s that
     alternate, so back-to-back exhibit logos each get a fresh slot.
     --------------------------------------------------------------------- */
  (() => {
    const logo = document.getElementById("whid-logo");
    if (!logo) return;
    const main = logo.querySelector(".whid-logo__main");
    const alts = [...logo.querySelectorAll(".whid-logo__alt")];
    const slots = [main, ...alts];
    const ORDER = ["messages", "bots", "games", "oc", "dub", "lowlights", "you"];
    const BURST_HOPS = 7;
    const SWAP_MS = 100;
    let timer = 0;
    let settle = 0;
    let running = false;
    let current = main;
    main.classList.add("is-visible");
    if (reduceMotion) return;

    // Park every slot in its resting class (visible or hidden).
    const settleAll = () => {
      clearTimeout(settle);
      slots.forEach((el) => {
        el.classList.remove("is-drop", "is-rise");
        el.classList.toggle("is-visible", el === current);
        el.classList.toggle("is-hidden", el !== current);
      });
    };
    const show = (key) => {
      const next = key === "main" ? main : alts.find((a) => a !== current) || alts[0];
      if (next === current) return;
      settleAll();
      if (key !== "main") next.src = `assets/logos/${key}.svg`;
      const prev = current;
      current = next;
      void next.offsetWidth; // restart the animations if the slot just ran one
      prev.classList.remove("is-visible");
      prev.classList.add("is-drop");
      next.classList.remove("is-hidden");
      next.classList.add("is-rise");
      settle = setTimeout(settleAll, SWAP_MS);
    };
    const schedule = (ms, fn) => {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
    const burst = (hop) => {
      if (!running) return;
      if (hop >= BURST_HOPS) {
        show("main");
        schedule(rand(4000, 6000), () => burst(0));
        return;
      }
      show(ORDER[hop % ORDER.length]);
      schedule(rand(100, 150), () => burst(hop + 1));
    };

    // Preload alternates so the burst doesn't flicker on first run.
    ORDER.forEach((k) => {
      const img = new Image();
      img.src = `assets/logos/${k}.svg`;
    });

    onVisibility(logo, (visible) => {
      running = visible;
      clearTimeout(timer);
      if (visible) schedule(rand(4000, 6000), () => burst(0));
      else show("main");
    });
  })();

  /* ---------------------------------------------------------------------
     Front door: the sign-in button is a prop. A click rolls the label over
     to "Just kidding!"; the next click rolls it back. Both labels share
     one grid cell (.conic-button__label), so this is class-only: the
     outgoing label gets .is-out, the incoming .is-in, and once the roll
     has finished the outgoing one is parked below again. aria-hidden
     follows the visible label so the button's accessible name tracks it.
     --------------------------------------------------------------------- */
  (() => {
    const button = document.querySelector("#front-door .conic-button");
    if (!button) return;
    const labels = [...button.querySelectorAll(".conic-button__text")];
    if (labels.length < 2) return;
    const ROLL_MS = 460; // matches the transition in the CSS
    let current = Math.max(0, labels.findIndex((el) => el.classList.contains("is-in")));
    let park = 0;

    const parkOthers = () => {
      labels.forEach((el, i) => i !== current && el.classList.remove("is-out"));
    };
    button.addEventListener("click", () => {
      const prev = current;
      current = (current + 1) % labels.length;
      labels.forEach((el, i) => {
        el.classList.toggle("is-in", i === current);
        el.classList.toggle("is-out", i === prev);
        if (i === current) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", "true");
      });
      clearTimeout(park);
      if (reduceMotion) parkOthers();
      else park = setTimeout(parkOthers, ROLL_MS);
    });
  })();

  /* ---------------------------------------------------------------------
     Messages shapes (DartingYellowCircle, PivotingRedSquare,
     ReflectingBlueTriangle). Each shape has an outer element carrying the
     committed transform and an inner element that animates one move with
     `transition: transform 700ms cubic-bezier(.9,0,.1,1)`. On transitionend
     the move is folded into the outer transform and the inner resets.
     --------------------------------------------------------------------- */
  (() => {
    const stage = document.querySelector(".messages-stage");
    if (!stage) return;
    const DART = 1.1;

    // Reset the inner element without animating.
    const snapReset = (inner) => {
      inner.style.transition = "none";
      inner.style.transform = "";
      inner.style.transformOrigin = "";
      void inner.offsetWidth;
      inner.style.transition = "";
    };

    // Wrap a shape back into the stage once it's fully outside (so the jump
    // is never seen). `box` is the shape's current bounding rect.
    const wrapDelta = (box) => {
      const s = stage.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (box.right < s.left) dx = s.width + box.width;
      else if (box.left > s.right) dx = -(s.width + box.width);
      if (box.bottom < s.top) dy = s.height + box.height;
      else if (box.top > s.bottom) dy = -(s.height + box.height);
      return { dx, dy };
    };

    /* Yellow circle: darts away from the pointer by 1.1× its size. */
    (() => {
      const outer = stage.querySelector(".shape--circle");
      if (!outer) return;
      const inner = outer.querySelector(".shape__inner");
      let idle = true;
      let ox = 0;
      let oy = 0;
      let pending = null;

      inner.addEventListener("pointermove", (ev) => {
        if (!idle) return;
        const r = inner.getBoundingClientRect();
        const dx = ev.clientX - (r.left + r.width / 2);
        const dy = ev.clientY - (r.top + r.height / 2);
        const dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "w" : "e") : dy >= 0 ? "n" : "s";
        const d = { w: [-1, 0], e: [1, 0], n: [0, -1], s: [0, 1] }[dir];
        idle = false;
        pending = d;
        const size = outer.offsetWidth;
        inner.style.transform = `translate(${d[0] * DART * size}px, ${d[1] * DART * size}px)`;
      });
      inner.addEventListener("transitionend", (ev) => {
        if (ev.target !== inner || !pending) return;
        const size = outer.offsetWidth;
        ox += pending[0] * DART;
        oy += pending[1] * DART;
        pending = null;
        const w = wrapDelta(inner.getBoundingClientRect());
        ox += w.dx / size;
        oy += w.dy / size;
        outer.style.transform = `translate(${ox * size}px, ${oy * size}px)`;
        snapReset(inner);
        idle = true;
      });
    })();

    /* Red square: pivots 180° around its corner farthest from the pointer. */
    (() => {
      const outer = stage.querySelector(".shape--square");
      if (!outer) return;
      const inner = outer.querySelector(".shape__inner");
      const ORIGIN = { tl: "0% 0%", tr: "100% 0%", br: "100% 100%", bl: "0% 100%" };
      const DELTA = { tl: [-1, -1], tr: [1, -1], br: [1, 1], bl: [-1, 1] };
      let idle = true;
      let ox = 0;
      let oy = 0;
      let corner = null;

      inner.addEventListener("pointermove", (ev) => {
        if (!idle) return;
        const r = inner.getBoundingClientRect();
        const isTop = ev.clientY < r.top + r.height / 2;
        const isLeft = ev.clientX < r.left + r.width / 2;
        corner = isTop ? (isLeft ? "br" : "bl") : isLeft ? "tr" : "tl";
        idle = false;
        inner.style.transformOrigin = ORIGIN[corner];
        inner.style.transform = "rotate(180deg)";
      });
      inner.addEventListener("transitionend", (ev) => {
        if (ev.target !== inner || !corner) return;
        const [dx, dy] = DELTA[corner];
        corner = null;
        ox += dx;
        oy += dy;
        const w = wrapDelta(inner.getBoundingClientRect());
        ox += w.dx / outer.offsetWidth;
        oy += w.dy / outer.offsetHeight;
        outer.style.transform = `translate(${ox * 100}%, ${oy * 100}%)`;
        snapReset(inner);
        idle = true;
      });
    })();

    /* Blue triangle: reflects across its side farthest from the pointer.
       The outer element carries a committed 2D matrix (origin 0 0); the
       pointer is mapped through its inverse so "farthest side" is judged
       in the triangle's own frame. */
    (() => {
      const outer = stage.querySelector(".shape--triangle");
      if (!outer) return;
      const inner = outer.querySelector(".shape__inner");
      let M = new DOMMatrix();
      let idle = true;
      let side = null;

      const applyOuter = () => {
        outer.style.transform = M.toString();
      };
      const layoutOrigin = () => {
        // Untransformed top-left of the outer element, in viewport coords.
        const s = stage.getBoundingClientRect();
        return { x: s.left + outer.offsetLeft, y: s.top + outer.offsetTop };
      };

      inner.addEventListener("pointermove", (ev) => {
        if (!idle) return;
        const w = outer.offsetWidth;
        const h = outer.offsetHeight;
        const o = layoutOrigin();
        const p = M.inverse().transformPoint(new DOMPoint(ev.clientX - o.x, ev.clientY - o.y));
        const dRight = Math.abs(w - p.x);
        const dBottom = Math.abs(h - p.y);
        const dHyp = Math.abs(h * p.x + w * p.y - w * h) / Math.hypot(w, h);
        const max = Math.max(dRight, dBottom, dHyp);
        side = max === dRight ? "right" : max === dBottom ? "bottom" : "hyp";
        idle = false;
        if (side === "right") {
          inner.style.transformOrigin = "100% 50%";
          inner.style.transform = "rotateY(180deg)";
        } else if (side === "bottom") {
          inner.style.transformOrigin = "50% 100%";
          inner.style.transform = "rotateX(180deg)";
        } else {
          inner.style.transformOrigin = "50% 50%";
          inner.style.transform = `rotate3d(${w}, ${-h}, 0, 180deg)`;
        }
      });
      inner.addEventListener("transitionend", (ev) => {
        if (ev.target !== inner || !side) return;
        const w = outer.offsetWidth;
        const h = outer.offsetHeight;
        let flip;
        if (side === "right") flip = new DOMMatrix([-1, 0, 0, 1, 2 * w, 0]);
        else if (side === "bottom") flip = new DOMMatrix([1, 0, 0, -1, 0, 2 * h]);
        else {
          const l2 = w * w + h * h;
          flip = new DOMMatrix([
            (w * w - h * h) / l2,
            (-2 * h * w) / l2,
            (-2 * h * w) / l2,
            (h * h - w * w) / l2,
            (2 * h * h * w) / l2,
            (2 * h * w * w) / l2,
          ]);
        }
        side = null;
        M = M.multiply(flip);
        const wrap = wrapDelta(inner.getBoundingClientRect());
        if (wrap.dx || wrap.dy) M = new DOMMatrix().translate(wrap.dx, wrap.dy).multiply(M);
        applyOuter();
        snapReset(inner);
        idle = true;
      });
    })();
  })();

  /* ---------------------------------------------------------------------
     Holographic card (HolographicCard.tsx + useTicketRevealAnimation).
     Pointer tilt with 0.12 smoothing per frame, shimmer/glare follow the
     tilt. `initHolo` is reused for every .holo on the page.

     The tilt target is the whole page: every card tracks the pointer
     wherever it is in the viewport. One window listener and one rAF loop
     are shared by all cards; the tilt is the pointer's offset from each
     card's center, normalized so the maximum angle is reached
     HOLO_REACH half-widths (half-heights) away and clamped there. Cards
     off-screen are skipped. When the pointer leaves the window, or the
     input is touch, the cards ease back to flat.
     --------------------------------------------------------------------- */
  const MAX_TILT = 10;
  const HOLO_REACH = 2; // half-card widths from center for max tilt
  const holoCards = [];
  const holoPointer = { x: 0, y: 0, active: false };
  let holoRaf = 0;
  let holoDirty = false;
  let holoWired = false;

  const clamp1 = (v) => Math.max(-1, Math.min(1, v));

  // Recompute every visible card's target from the stored pointer.
  function holoRetarget() {
    for (const c of holoCards) {
      if (!c.visible) continue;
      if (!holoPointer.active) {
        c.tx = 0;
        c.ty = 0;
        continue;
      }
      const r = c.card.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      c.tx = clamp1((holoPointer.x - cx) / (r.width / 2) / HOLO_REACH);
      c.ty = clamp1((holoPointer.y - cy) / (r.height / 2) / HOLO_REACH);
    }
  }

  function holoFrame() {
    if (holoDirty) {
      holoDirty = false;
      holoRetarget();
    }
    let settled = true;
    for (const c of holoCards) {
      if (!c.visible) continue;
      if (Math.abs(c.tx - c.x) < 0.001 && Math.abs(c.ty - c.y) < 0.001) continue;
      settled = false;
      c.x += (c.tx - c.x) * 0.12;
      c.y += (c.ty - c.y) * 0.12;
      const { x, y, card, shimmer, glare } = c;
      const tilt = Math.min(1, Math.hypot(x, y));
      card.style.transform = `rotateX(${(-y * MAX_TILT).toFixed(3)}deg) rotateY(${(x * MAX_TILT).toFixed(3)}deg)`;
      if (shimmer) {
        shimmer.style.filter = `brightness(${0.8 + tilt * 0.6})`;
        shimmer.style.backgroundPosition = `${50 + x * 40}% ${50 + y * 40}%`;
        shimmer.style.opacity = `${0.2 + tilt * 0.2}`;
        shimmer.style.maskPosition = `${50 - x * 50}% 0%, 0% 0%`;
      }
      if (glare) {
        glare.style.background = `radial-gradient(circle at ${50 - x * 35}% ${50 - y * 35}%, rgba(255,255,255,0.15) 0%, transparent 45%)`;
      }
    }
    holoRaf = settled && !holoDirty ? 0 : requestAnimationFrame(holoFrame);
  }

  function holoKick() {
    holoDirty = true;
    if (!holoRaf) holoRaf = requestAnimationFrame(holoFrame);
  }

  function holoFlatten() {
    if (!holoPointer.active) return;
    holoPointer.active = false;
    holoKick();
  }

  function wireHolo() {
    if (holoWired) return;
    holoWired = true;
    window.addEventListener(
      "pointermove",
      (ev) => {
        // Touch has no hover; keep the cards flat.
        if (ev.pointerType === "touch") return holoFlatten();
        holoPointer.x = ev.clientX;
        holoPointer.y = ev.clientY;
        holoPointer.active = true;
        holoKick();
      },
      { passive: true },
    );
    // pointerout with no relatedTarget means the pointer left the window.
    window.addEventListener("pointerout", (ev) => {
      if (!ev.relatedTarget) holoFlatten();
    });
    window.addEventListener("blur", holoFlatten);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) holoFlatten();
    });
    // Scrolling moves the cards under a stationary pointer.
    window.addEventListener("scroll", () => holoPointer.active && holoKick(), { passive: true });
    window.addEventListener("resize", holoKick, { passive: true });
  }

  function initHolo(root) {
    const card = root.querySelector(".holo__card");
    if (!card) return;
    const entry = {
      card,
      shimmer: root.querySelector(".holo__shimmer"),
      glare: root.querySelector(".holo__glare"),
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      visible: false,
    };
    holoCards.push(entry);
    onVisibility(card, (visible) => {
      entry.visible = visible;
      if (visible) holoKick();
    });
    wireHolo();
  }

  // Card enter (0→1500 ms) when scrolled into view.
  function enterCard(card) {
    if (card.dataset.enter !== "pending") return;
    card.dataset.enter = "done";
    if (reduceMotion) return;
    card.animate(
      [
        { opacity: 0, translate: "0 32px" },
        { opacity: 1, translate: "0 0" },
      ],
      { duration: 1500, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
    );
  }

  // Stamp drop (600→1680 ms, impact at 1486) plus card kickback
  // (1486→2050, peak 1750). Returns the total duration.
  function dropStamp(card, stamp) {
    const base = parseFloat(stamp.style.getPropertyValue("--r")) || 0;
    stamp.removeAttribute("data-pending");
    if (reduceMotion) return 0;
    // ticketRevealTimeline.ts: fall 600→1486 on cubic-bezier(.55,0,.85,.15)
    // with opacity 0→1 and blur 6→0 riding the same curve, then a 194 ms
    // settle from the 1.08 squash to rest.
    const drop = stamp.animate(
      [
        {
          offset: 0,
          opacity: 0,
          filter: "blur(6px)",
          transform: `translate(-50%, -170%) scale(7) rotate(${base + 14}deg)`,
          easing: "cubic-bezier(0.55, 0, 0.85, 0.15)",
        },
        {
          offset: (1486 - 600) / 1080,
          opacity: 1,
          filter: "blur(0px)",
          transform: `translate(-50%, -46%) scale(1.08) rotate(${base - 1}deg)`,
          easing: "cubic-bezier(0.2, 0.8, 0.3, 1)",
        },
        {
          offset: 1,
          opacity: 1,
          filter: "blur(0px)",
          transform: `translate(-50%, -50%) scale(1) rotate(${base}deg)`,
        },
      ],
      { duration: 1080, delay: 600, fill: "both" },
    );
    drop.onfinish = () => {
      drop.commitStyles?.();
      drop.cancel();
    };
    card.animate(
      [
        { offset: 0, transform: "translateY(0) translateZ(0) rotate(0deg)", easing: "cubic-bezier(0, 1, 0.3, 1)" },
        {
          offset: (1750 - 1486) / (2050 - 1486),
          transform: "translateY(5px) translateZ(-110px) rotate(0.5deg)",
          easing: "cubic-bezier(0.4, 0, 0.3, 1)",
        },
        { offset: 1, transform: "translateY(0) translateZ(0) rotate(0deg)" },
      ],
      { duration: 2050 - 1486, delay: 1486, composite: "add" },
    );
    return 2050;
  }

  // Inline the ticket SVG so the member name renders in the loaded webfont
  // (an <img> SVG can't reach external fonts). Falls back to the <img>.
  async function inlineTicket(img) {
    try {
      const res = await fetch(img.getAttribute("src"));
      if (!res.ok) return;
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const svg = doc.documentElement;
      if (svg.nodeName !== "svg") return;
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("aria-hidden", "true");
      const name = img.dataset.name;
      if (name) {
        const span = svg.querySelector('#dy tspan');
        if (span) span.textContent = name;
      }
      img.replaceWith(document.adoptNode(svg));
    } catch {
      /* file:// or offline: keep the <img> */
    }
  }

  document.querySelectorAll(".holo").forEach((root) => {
    initHolo(root);
    const card = root.querySelector(".holo__card");
    const ticketImg = root.querySelector("img[data-ticket]");
    if (ticketImg) inlineTicket(ticketImg);

    const hint = root.parentElement?.querySelector(".ticket-hint");
    const pendingStamp = root.querySelector(".ticket-stamp[data-pending]");
    let busy = false;

    if (card.dataset.enter === "pending") {
      onVisibility(
        card,
        (visible, entry) => {
          if (!visible) return;
          entry.target && enterCard(card);
          if (hint) setTimeout(() => hint.classList.add("is-visible"), 3000);
        },
        { rootMargin: "0px 0px -20% 0px" },
      );
    }

    // Click: drop the stamp. Once it has landed, clicks replay the drop so
    // the motion can be recorded any number of times.
    card.addEventListener("click", () => {
      if (busy) return;
      const stamp = pendingStamp || root.querySelector(".ticket-stamp[data-replay]");
      if (!stamp) return;
      busy = true;
      hint?.classList.remove("is-visible");
      const ms = dropStamp(card, stamp);
      setTimeout(() => {
        busy = false;
        if (hint) {
          hint.textContent = hint.dataset.after || hint.textContent;
          hint.classList.add("is-visible");
        }
      }, ms);
    });
  });

  /* ---------------------------------------------------------------------
     Bots: petal swarm (CherryBlossomPetals constants) on a 2D canvas over
     the whole exhibit. The museum's canvas was the viewport, so world units
     are sized from the viewport height here too; petals keep their size and
     speed on the tall section and the count grows with the extra area.
     --------------------------------------------------------------------- */
  (() => {
    const section = document.querySelector('[data-theme="bots"].exhibit');
    const canvas = section?.querySelector(".bots-petals");
    if (!section || !canvas || reduceMotion) return;
    const ctx = canvas.getContext("2d");
    const SPRITES = ["broad", "curled", "narrow"].map((k) => {
      const img = new Image();
      img.src = `assets/bots/petal-${k}.png`;
      return img;
    });
    const C = {
      count: 60,
      vx: [-1.4, -0.7],
      vy: [0.35, 0.75],
      rotY: 2.0,
      rotZ: 1.2,
      wind: { freq: [0.4, 0.9], ax: [0.12, 0.28], ay: [0.07, 0.16] },
      fine: { freq: [1.3, 2.5], ax: [0.05, 0.1], ay: [0.04, 0.08] },
      wobble: { freq: [0.3, 0.7], amp: 0.3 },
      tumble: 1.6,
      minTumble: 0.25,
      depth: 2.5,
      scale: [0.1, 0.3],
      margin: 1.2,
      topSpawn: 0.3,
      maxDt: 0.05,
      worldH: 9.3, // visible height at fov 50, camera z 10 (one viewport)
    };
    let W = 1;
    let H = 1;
    let worldW = 1;
    let worldH = C.worldH;
    let pxPerUnit = 1;
    let petals = [];
    let running = false;
    let last = 0;
    let raf = 0;

    const spawn = (p, initial) => {
      p.sprite = pick(SPRITES);
      p.scale = rand(...C.scale);
      p.z = rand(-C.depth / 2, C.depth / 2);
      p.vx = rand(...C.vx);
      p.vy = rand(...C.vy);
      p.rotY = rand(0, Math.PI * 2);
      p.rotZ = rand(0, Math.PI * 2);
      p.rotYRate = rand(-C.rotY, C.rotY);
      p.rotZRate = rand(-C.rotZ, C.rotZ);
      p.wf = rand(...C.wind.freq);
      p.wax = rand(...C.wind.ax);
      p.way = rand(...C.wind.ay);
      p.ff = rand(...C.fine.freq);
      p.fax = rand(...C.fine.ax);
      p.fay = rand(...C.fine.ay);
      p.wobf = rand(...C.wobble.freq);
      p.phase = rand(0, Math.PI * 2);
      if (initial) {
        p.x = rand(-worldW / 2, worldW / 2);
        p.y = rand(-worldH / 2, worldH / 2);
      } else if (Math.random() < C.topSpawn) {
        p.x = rand(-worldW / 2, worldW / 2 + C.margin);
        p.y = worldH / 2 + C.margin;
      } else {
        p.x = worldW / 2 + C.margin;
        p.y = rand(-worldH / 2, worldH / 2 + C.margin);
      }
      return p;
    };
    const resize = () => {
      const r = section.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(1, Math.floor(r.width));
      H = Math.max(1, Math.floor(r.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const viewH = Math.max(1, innerHeight);
      pxPerUnit = viewH / C.worldH;
      worldH = H / pxPerUnit;
      worldW = W / pxPerUnit;
      const count = Math.round(C.count * Math.max(1, H / viewH));
      if (petals.length > count) petals.length = count;
      while (petals.length < count) petals.push(spawn({}, true));
    };
    const step = (now) => {
      if (!running) return;
      const t = now / 1000;
      const dt = Math.min(C.maxDt, last ? t - last : 0.016);
      last = t;
      ctx.clearRect(0, 0, W, H);
      for (const p of petals) {
        const wx = Math.sin(t * p.wf + p.phase) * p.wax + Math.sin(t * p.ff + p.phase) * p.fax;
        const wy = Math.cos(t * p.wf + p.phase) * p.way + Math.cos(t * p.ff + p.phase) * p.fay;
        p.x += (p.vx + wx) * dt;
        p.y -= (p.vy + wy) * dt; // world y up; petals fall
        const speed = Math.hypot(wx, wy) * C.tumble + C.minTumble;
        p.rotY += p.rotYRate * speed * dt;
        p.rotZ += p.rotZRate * speed * dt + Math.sin(t * p.wobf + p.phase) * C.wobble.amp * dt;
        if (p.x < -worldW / 2 - C.margin || p.y < -worldH / 2 - C.margin) spawn(p, false);

        const persp = 10 / (10 - p.z);
        const sx = (p.x * persp + worldW / 2) * pxPerUnit;
        const sy = (worldH / 2 - p.y * persp) * pxPerUnit;
        const img = p.sprite;
        if (!img.complete || !img.naturalWidth) continue;
        const h = p.scale * persp * 0.9 * pxPerUnit;
        const w = (h * img.naturalWidth) / img.naturalHeight;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.rotZ);
        ctx.scale(Math.max(0.08, Math.abs(Math.cos(p.rotY))), 1);
        ctx.globalAlpha = 0.85 + 0.15 * ((p.z + C.depth / 2) / C.depth);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
      raf = requestAnimationFrame(step);
    };
    new ResizeObserver(resize).observe(section);
    addEventListener("resize", resize);
    resize();
    onVisibility(section, (visible) => {
      running = visible;
      cancelAnimationFrame(raf);
      last = 0;
      if (visible) raf = requestAnimationFrame(step);
    });
  })();

  /* ---------------------------------------------------------------------
     Lowlights diorama: click cycles Dumpy's line; the bubble pops (scale
     1 → 1.07 → 1 over 200 ms) on every change like Dumpy.tsx.
     --------------------------------------------------------------------- */
  (() => {
    const stage = document.querySelector(".diorama");
    const bubble = stage?.querySelector(".bubble-right");
    if (!stage || !bubble) return;
    let lines = [];
    try {
      lines = JSON.parse(bubble.dataset.lines || "[]");
    } catch {
      lines = [];
    }
    let i = 0;
    const next = () => {
      if (lines.length < 2) return;
      i = (i + 1) % lines.length;
      bubble.textContent = lines[i];
      bubble.classList.remove("is-pop");
      void bubble.offsetWidth;
      bubble.classList.add("is-pop");
    };
    stage.addEventListener("click", next);
    stage.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        next();
      }
    });
  })();

  /* ---------------------------------------------------------------------
     Gamers: staggered reveal (Reveal.tsx) and letter scramble on placards.
     --------------------------------------------------------------------- */
  (() => {
    const groups = document.querySelectorAll(".reveal-group");
    groups.forEach((group) => {
      const stagger = Number(group.dataset.stagger || 1500);
      onVisibility(
        group,
        (visible) => {
          if (!visible || group.classList.contains("is-in")) return;
          [...group.children].forEach((child, i) => {
            child.style.transitionDelay = `${i * stagger}ms`;
          });
          group.classList.add("is-in");
          group.querySelectorAll("[data-scramble]").forEach((el) => scramble(el));
        },
        { threshold: 0.5 },
      );
    });

    // 70 ms cycle for 1800 ms, letters only, Latin + Czech pool.
    const POOL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ";
    function scramble(el) {
      if (reduceMotion) return;
      const final = el.dataset.scramble || el.textContent;
      el.dataset.scramble = final;
      const start = performance.now();
      const tick = () => {
        const p = Math.min(1, (performance.now() - start) / 1800);
        const settled = Math.floor(final.length * p);
        el.textContent = [...final]
          .map((ch, i) => (i < settled || !/\p{L}/u.test(ch) ? ch : pick(POOL)))
          .join("");
        if (p < 1) setTimeout(tick, 70);
        else el.textContent = final;
      };
      tick();
    }
  })();

  /* ---------------------------------------------------------------------
     OC: character reveal (RevealContent + useRevealStepper). Text nodes
     inside .reveal-content are split into per-character spans and revealed
     on a time budget; a blinking cursor trails the last character without
     disturbing the layout. Clicking the page finishes it.
     --------------------------------------------------------------------- */
  (() => {
    const page = document.querySelector(".reveal-content");
    if (!page) return;
    // The museum rests at the end of each line (lineEndPause/headingEndPause);
    // here a line break costs no more than an ordinary keystroke, so the text
    // keeps a steady typing rhythm across paragraphs.
    const OPT = { speed: 3, lineEndPause: 0, blockRevealPause: 1200, blockPreRevealPause: 800, headingEndPause: 0 };
    const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "LI", "BLOCKQUOTE", "FIGURE", "PRE"]);
    const entries = [];

    // Split text nodes into spans; collect reveal entries in document order.
    const walk = (node, inHeading) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.textContent.trim() && !node.textContent.includes(" ")) return;
        const frag = document.createDocumentFragment();
        for (const ch of node.textContent) {
          const span = document.createElement("span");
          span.className = "reveal-char";
          span.textContent = ch;
          frag.appendChild(span);
          entries.push({ type: "char", el: span, ch, inHeading });
        }
        node.replaceWith(frag);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.classList.contains("reveal-block")) {
        entries.push({ type: "block", el: node });
        return;
      }
      const heading = inHeading || /^H[1-6]$/.test(node.tagName);
      [...node.childNodes].forEach((c) => walk(c, heading));
      if (BLOCK_TAGS.has(node.tagName)) {
        entries.push({ type: heading ? "headingEnd" : "lineEnd", el: node });
      }
    };
    [...page.childNodes].forEach((c) => walk(c, false));

    const cursor = document.createElement("span");
    cursor.className = "reveal-cursor";
    let i = 0;
    let prev = null;
    let timer = 0;
    let started = false;
    let done = false;

    const keystrokeDelay = (prevCh, ch) => {
      // Approximation of computeKeystrokeDelay: base speed with pauses after
      // punctuation and a little jitter.
      let ms = 1000 / (OPT.speed * 12);
      if (ch === " ") ms *= 0.6;
      if (prevCh && /[.!?]/.test(prevCh)) ms += 180;
      else if (prevCh && /[,;:]/.test(prevCh)) ms += 90;
      return ms * rand(0.7, 1.4);
    };
    const cost = (e) => {
      switch (e.type) {
        case "char": {
          const d = keystrokeDelay(prev, e.ch);
          return e.inHeading ? d * 2 : d;
        }
        case "lineEnd":
          return OPT.lineEndPause;
        case "headingEnd":
          return OPT.headingEndPause;
        case "block":
          return OPT.blockPreRevealPause;
      }
      return 0;
    };
    // Every character is in the DOM from the start (unrevealed ones are just
    // transparent), and the cursor is taken out of flow by .reveal-cursor, so
    // tracking the last revealed character never re-wraps a line or changes
    // the page's height: nothing below the document moves while it types.
    const placeCursor = (el) => {
      if (el) el.after(cursor);
    };
    const reveal = (e) => {
      e.el.classList.add("is-revealed");
      if (e.type === "char") {
        prev = e.ch;
        placeCursor(e.el);
      } else if (e.type === "block") {
        placeCursor(e.el);
      }
    };
    const finish = () => {
      done = true;
      clearTimeout(timer);
      entries.forEach((e) => e.el.classList.add("is-revealed"));
      cursor.remove();
    };
    const tick = () => {
      if (done) return;
      if (i >= entries.length) return finish();
      const e = entries[i++];
      reveal(e);
      const wait = cost(e) + (e.type === "block" ? OPT.blockRevealPause : 0);
      timer = setTimeout(tick, wait);
    };
    const start = () => {
      if (started) return;
      started = true;
      if (reduceMotion) return finish();
      // RevealCursor.init: park the cursor before the first character rather
      // than at the end of the document.
      const first = entries.find((e) => e.type === "char");
      if (first) first.el.before(cursor);
      else page.appendChild(cursor);
      tick();
    };

    page.addEventListener("click", () => {
      if (!started) start();
      else finish();
    });
    onVisibility(page, (visible) => {
      if (visible) start();
    }, { threshold: 0.25 });
  })();
})();
