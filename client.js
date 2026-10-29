// glm-coding-quota — Client half (v6)
// Mounts its own React root left of the model selector in the composer bottom
// bar (dsh-usage's foot-card pattern). Hover card replicates ZCode's quota
// panel layout: "剩余额度" header + green plan badge + 更多 ›, then one column
// per window (label / big remaining % · reset time / matching-color bar). The
// team API returns no MCP window, so that column is simply absent.

window.__ModuleLoader__.load({
  id: 'glm-coding-quota',
  factory(require) {
    const React = require('react');
    const ReactDOM = require('react-dom/client');
    const h = React.createElement;
    // createPortal lives in 'react-dom', NOT 'react-dom/client'.
    let createPortal = null;
    try {
      const ReactDOMLegacy = require('react-dom');
      createPortal = ReactDOMLegacy.createPortal || null;
    } catch {}

    const POLL_MS = 5 * 60 * 1000;
    const R = 9;
    const CIRC = 2 * Math.PI * R;
    const MARK = 'data-glm-quota-ring';
    const MODEL_RE = /glm|最高|flash|pro|max|deepseek|claude|gpt|mini|标准|sonnet|opus|haiku/i;

    function fmtReset(ms, weekly) {
      if (!ms) return '';
      const d = new Date(ms);
      if (weekly) return `${d.getMonth() + 1}月${d.getDate()}日`;
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function levelColor(remaining) {
      if (remaining >= 40) return '#22c55e';
      if (remaining >= 15) return '#f59e0b';
      return '#ef4444';
    }

    function rowColor(item) {
      if (item.key === '3:5' || /小时/.test(item.label)) return '#3b82f6';
      if (item.key === '6:1' || /周/.test(item.label)) return '#22c55e';
      return '#f59e0b';
    }

    function worstOf(limits) {
      if (!limits.length) return 100;
      return Math.min(...limits.map((l) => l.remainingPct));
    }

    // Ring tracks the 5-hour window only (weekly quota lives in the hover card).
    function ringPctOf(limits) {
      const five = limits.filter(
        (l) => l.key === '3:5' || /小时/.test(l.label),
      );
      return worstOf(five.length ? five : limits);
    }

    function Ring(props) {
      const { limits, loading } = props;
      const pct = ringPctOf(limits);
      const color = levelColor(pct);
      // Segmented tick ring, sized so the gaps read clearly: 24px svg, r=9,
      // 8 fat ticks with visible spacing (ZCode-style dial).
      const N = 8;
      const step = 360 / N;
      const segLen = (CIRC / N) * 0.58;
      const lit = Math.round((pct / 100) * N);
      const ticks = [];
      for (let i = 0; i < N; i += 1) {
        const on = i < lit;
        ticks.push(h('circle', {
          key: i,
          cx: 12, cy: 12, r: R, fill: 'none',
          stroke: on ? color : '#e2e4e8',
          strokeWidth: on ? 4 : 3,
          strokeDasharray: `${segLen} ${CIRC - segLen}`,
          transform: `rotate(${-90 + i * step} 12 12)`,
          style: { transition: 'stroke .3s ease', opacity: loading ? 0.55 : 1 },
        }));
      }
      return h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', style: { display: 'block' } }, ticks);
    }

    // Segmented tick bar: 10 discrete blocks, ▮▮▮▮▯▯ style.
    function SegBar(pct, color) {
      const filled = Math.round(pct / 10);
      const segs = [];
      for (let i = 0; i < 10; i += 1) {
        segs.push(h('div', {
          key: i,
          style: {
            width: 4.5, height: 8, borderRadius: 1,
            background: i < filled ? color : '#e9eaec',
            transition: 'background .3s ease',
          },
        }));
      }
      return h('div', { style: { display: 'inline-flex', gap: 2, flexShrink: 0 } }, segs);
    }

    // One compact row per window: label · segmented tick bar · % · reset time.
    function WindowCol(props) {
      const { item } = props;
      const weekly = item.key === '6:1' || /周/.test(item.label);
      const reset = fmtReset(item.resetAt, weekly);
      const color = rowColor(item);
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
        h('span', { style: { fontSize: 11.5, fontWeight: 500, color: '#374151', whiteSpace: 'nowrap' } }, item.label),
        h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
          SegBar(item.remainingPct, color),
          h('span', {
            style: { fontSize: 12.5, fontWeight: 700, color: '#1f2328', fontVariantNumeric: 'tabular-nums' },
          }, item.remainingPct + '%'),
        ),
        reset
          ? h('span', { style: { fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' } }, '· ' + reset)
          : null,
        h('span', { style: { flex: 1 } }),
      );
    }

    function Card(props) {
      const { data, loading, styleOverride } = props;
      const items = data?.limits ?? [];
      return h('div', {
        onClick: (e) => e.stopPropagation(),
        style: {
          position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, width: 250,
          background: '#ffffff', borderRadius: 10,
          border: '1px solid #ececec',
          boxShadow: '0 6px 22px rgba(0,0,0,.10)',
          padding: '9px 11px 9px', zIndex: 2147483000,
          ...(styleOverride || {}),
        },
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 } },
          h('span', { style: { fontSize: 13, fontWeight: 600, color: '#1f2328' } }, '剩余额度'),
          data?.level
            ? h('span', {
                style: {
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 10.5, fontWeight: 500, color: '#16a34a', background: '#e7f8ee',
                  borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap',
                },
              },
              h('span', { style: { fontSize: 10, lineHeight: 1 } }, '⏱'),
              'Max · 含重置')
            : null,
          h('span', { style: { flex: 1 } }),
          loading ? h('span', { style: { fontSize: 10, color: '#22c55e' } }, '…') : null,
        ),
        items.length
          ? h('div', {
              style: { display: 'flex', flexDirection: 'column', rowGap: 6 },
            }, items.map((it) => h(WindowCol, { key: it.key, item: it })))
          : h('div', { style: { fontSize: 11, color: '#9ca3af' } }, loading ? '加载中…' : '暂无额度窗口数据'),
        h('div', { style: { marginTop: 8, fontSize: 10, color: '#b3b9c1' } },
          data?.fetchedAt
            ? '更新于 ' + new Date(data.fetchedAt).toLocaleTimeString() + ' · 点击环立即刷新 · 5 分钟自动刷新'
            : '点击环立即刷新 · 5 分钟自动刷新'),
      );
    }

    function RingWidget() {
      const [state, setState] = React.useState({ loading: true, error: null, data: null });
      const [open, setOpen] = React.useState(false);
      const [cardStyle, setCardStyle] = React.useState(null);
      const boxRef = React.useRef(null);
      const enterT = React.useRef(null);
      const leaveT = React.useRef(null);

      // Portal host at body level: panes with transform/contain hijack
      // position:fixed; a body-level host is immune to all of them.
      const portalHost = React.useMemo(() => {
        const d = document.createElement('div');
        d.setAttribute('data-glm-quota-card', '1');
        return d;
      }, []);
      React.useEffect(() => {
        document.body.appendChild(portalHost);
        return () => portalHost.remove();
      }, [portalHost]);

      // Adaptive placement: fixed-position card (escapes overflow-clipping
      // ancestors), right-aligned to the composer BAR ROW's right edge (not
      // the split-view wrapper — that spans the file panel too). The bar row
      // is the first ancestor that is wide (>=320px) yet short (<=120px).
      const computeCardStyle = () => {
        const el = boxRef.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        let pr = null;
        let pane = el.parentElement;
        while (pane && pane !== document.body) {
          const q = pane.getBoundingClientRect();
          if (q.width >= 320 && q.height <= 120) { pr = q; break; }
          pane = pane.parentElement;
        }
        if (!pr) {
          // Fallback: clamp to the ring itself so the card never leaves the
          // chat pane even if the row is not identifiable.
          pr = { left: r.left, right: r.right, width: r.width };
        }
        const width = Math.min(250, Math.max(190, pr.width - 24));
        // Never let the card's right edge pass beyond the bar row's right
        // edge, and never let its left edge exit the pane's left side.
        // NOTE: the left-edge guard is an UPPER bound on `right` (Math.min);
        // using Math.max here shoves the card to the pane's left edge.
        const rightPx = Math.max(8, window.innerWidth - pr.right + 12);
        const maxRight = Math.max(8, window.innerWidth - (pr.left + width + 12));
        return {
          position: 'fixed',
          bottom: Math.max(60, window.innerHeight - r.top + 10),
          right: Math.min(rightPx, maxRight),
          width,
        };
      };

      const load = React.useCallback((force) => {
        setState((s) => ({ ...s, loading: true }));
        fetch('/api/glm-coding-quota/quota' + (force ? '?force=1' : ''), { cache: 'no-store' })
          .then((r) => r.json().then((b) => ({ status: r.status, body: b })))
          .then(({ status, body }) => {
            if (status === 200 && body?.ok) {
              setState({ loading: false, error: null, data: body });
            } else {
              setState({ loading: false, error: body?.error || ('HTTP ' + status), data: null });
            }
          })
          .catch((e) => setState({ loading: false, error: String(e?.message || e), data: null }));
      }, []);

      React.useEffect(() => {
        load(false);
        const timer = setInterval(() => load(false), POLL_MS);
        return () => {
          clearInterval(timer);
          clearTimeout(enterT.current);
          clearTimeout(leaveT.current);
        };
      }, [load]);

      const onEnter = () => {
        clearTimeout(leaveT.current);
        clearTimeout(enterT.current);
        enterT.current = setTimeout(() => {
          setCardStyle(computeCardStyle());
          setOpen(true);
        }, 150);
      };
      const onLeave = () => {
        clearTimeout(enterT.current);
        leaveT.current = setTimeout(() => setOpen(false), 250);
      };

      return h('div', {
        ref: boxRef,
        onMouseEnter: onEnter,
        onMouseLeave: onLeave,
        onClick: () => load(true),
        title: state.error
          ? 'GLM 额度获取失败，点击重试：' + state.error
          : 'GLM Coding Plan 剩余额度（悬停查看详情，点击刷新）',
        style: {
          position: 'relative', display: 'inline-flex', alignItems: 'center',
          padding: 2, borderRadius: 999, cursor: 'pointer', userSelect: 'none', lineHeight: 1.4,
        },
      },
        h(Ring, { limits: state.data?.limits ?? [], loading: state.loading }),
        state.error ? h('span', { style: { fontSize: 10, color: '#ef4444' } }, '!') : null,
        open && !state.error
          ? (createPortal
              ? createPortal(
                  h(Card, { data: state.data, loading: state.loading, styleOverride: cardStyle }),
                  portalHost,
                )
              : h(Card, { data: state.data, loading: state.loading }))
          : null,
      );
    }

    // Bottom-bar band and right-half bounds for the model cluster.
    function inBand(rect, vh, vw) {
      return rect.width > 0 && rect.height > 0
        && rect.top >= vh - 140
        && rect.left >= vw * 0.45;
    }

    // Climb from the deepest text element to the outermost ancestor that is
    // still a tight right-half cluster (not the full-width bar row).
    function clusterOf(el) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let cur = el;
      for (let i = 0; i < 12; i += 1) {
        const p = cur.parentElement;
        if (!p || p === document.body) break;
        const r = p.getBoundingClientRect();
        if (r.top < vh - 150) break;
        if (r.left < vw * 0.45) break;
        if (r.width > vw * 0.5) break;
        cur = p;
      }
      return cur;
    }

    // The shell can re-render the composer row (with our ring in it) into a
    // popover layer (.dsh-claude-popover-body etc.) — alive in DOM, invisible
    // to the user when the popover closes. The ring must never live in one.
    function inPopover(el) {
      return !!(
        el && el.closest &&
        el.closest('[class*="popover"], [class*="Popover"], [class*="popup"], [class*="Popup"], [class*="popper"], [class*="Popper"]')
      );
    }

    function findModelAnchor() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Fast path: interactive model-name elements.
      const sel = 'button, [role="combobox"], [role="button"], [class*="model"], [class*="Model"]';
      for (const el of document.querySelectorAll(sel)) {
        if (inPopover(el)) continue;
        const r = el.getBoundingClientRect();
        if (!inBand(r, vh, vw)) continue;
        const t = (el.textContent || '').trim();
        if (t.length < 2 || t.length > 60) continue;
        if (MODEL_RE.test(t)) return clusterOf(el);
      }

      // Slow path: deepest own-text element in the band matching a model name
      // (covers plain div/span selectors).
      let best = null;
      let bestDepth = -1;
      const walk = (el, depth) => {
        if (inPopover(el)) return; // never anchor inside a popover layer
        const r = el.getBoundingClientRect();
        if (inBand(r, vh, vw)) {
          const own = Array.from(el.childNodes).some(
            (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
          );
          if (own && (el.textContent || '').length <= 80 && MODEL_RE.test(el.textContent || '')) {
            if (depth > bestDepth) {
              best = el;
              bestDepth = depth;
            }
          }
        }
        for (const child of el.children) walk(child, depth + 1);
      };
      walk(document.body, 0);
      return best ? clusterOf(best) : null;
    }

    return {
      apply(ctx) {
        try {
          const container = document.createElement('div');
          container.setAttribute(MARK, '1');
          container.style.cssText =
            'display:inline-flex;align-items:center;justify-content:center;' +
            'margin-right:6px;flex:0 0 26px !important;' +
            'width:26px !important;min-width:26px !important;max-width:26px !important;' +
            'height:26px !important;min-height:26px !important;max-height:26px !important;';
          let root = null;
          let disposed = false;
          let raf = 0;

          const seat = () => {
            if (disposed) return true;
            // Hidden-but-connected is also "unseated": the shell can re-render
            // our row into a collapsed/zero-size wrapper. Detect and re-seat.
            const hidden =
              container.isConnected &&
              (container.offsetWidth === 0 || container.offsetHeight === 0);
            // Layout hijack: parent grid/flex reflow stretched us past the
            // hard clamp (shell CSS !important can beat inline !important).
            const stretched =
              container.isConnected &&
              (container.offsetWidth > 60 || container.offsetHeight > 60);
            // Swallowed by a popover layer: alive but invisible to the user.
            const swallowed = container.isConnected && inPopover(container);
            if (hidden || stretched || swallowed) container.remove();
            if (disposed || container.isConnected) return true;
            const anchor = findModelAnchor();
            if (!anchor || !anchor.parentNode) return false;
            anchor.parentNode.insertBefore(container, anchor);
            if (!root) root = ReactDOM.createRoot(container);
            root.render(h(RingWidget));
            return true;
          };

          const schedule = () => {
            if (disposed) return;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => seat());
          };

          // Self-heal: shell re-renders that displace the container re-seat it
          // on the next frame (dsh-usage's body-mutation hub pattern).
          const observer = new MutationObserver(() => {
            schedule();
          });
          observer.observe(document.body, { childList: true, subtree: true });

          // Permanent watchdog: every 2s verify the ring is seated AND visible;
          // never self-clear — a seat can be lost long after first success.
          const hunt = setInterval(() => {
            if (disposed) {
              clearInterval(hunt);
              return;
            }
            seat();
          }, 2000);
          seat();

          // Black-box beacon: report ring liveness to the host diag route so
          // vanish incidents leave evidence (connected/size/anchor/visibility).
          const appliedAt = Date.now();
          const beacon = () => {
            try {
              const rect = container.getBoundingClientRect();
              const p = container.parentElement;
              const cs = container.firstChild
                ? getComputedStyle(container.firstChild)
                : null;
              const payload = {
                appliedAt,
                at: Date.now(),
                disposed,
                connected: container.isConnected,
                w: container.offsetWidth,
                h: container.offsetHeight,
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                rw: Math.round(rect.width),
                rh: Math.round(rect.height),
                inView:
                  rect.width > 0 &&
                  rect.bottom > 0 &&
                  rect.top < innerHeight &&
                  rect.right > 0 &&
                  rect.left < innerWidth,
                opacity: cs ? cs.opacity : '',
                parent: p ? (p.tagName + '.' + String(p.className).slice(0, 50)) : '',
                anchorFound: !!findModelAnchor(),
                vis: document.visibilityState,
                href: location.hash.slice(0, 40),
              };
              fetch('/api/glm-coding-quota/diag', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true,
              }).catch(() => {});
            } catch {}
          };
          const beaconTimer = setInterval(beacon, 10000);
          setTimeout(beacon, 2500);

          ctx.effect(() => () => {
            disposed = true;
            if (hunt) clearInterval(hunt);
            clearInterval(beaconTimer);
            cancelAnimationFrame(raf);
            observer.disconnect();
            try {
              if (root) root.unmount();
            } catch {}
            container.remove();
          });
        } catch (e) {
          console.error('[glm-coding-quota] client apply failed', e);
        }
      },
    };
  },
});
