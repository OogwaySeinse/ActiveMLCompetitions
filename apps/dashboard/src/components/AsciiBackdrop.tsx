import { useEffect, useRef } from "react";

interface Cluster {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lines: string[];
  tint: string;
  alpha: number;
  phase: number;
}

const ML_ASCII_CLUSTERS: { lines: string[]; tint: string }[] = [
  {
    lines: [
      "┌─ CV_FOLD_04 ─────────┐",
      "│ OOF_AUC : 0.94821    │",
      "│ PUB_LB  : 0.94790 ▲  │",
      "└──────────────────────┘",
    ],
    tint: "rgba(110, 231, 183, 0.72)",
  },
  {
    lines: [
      "∇_θ ℒ(f_θ(x), y) = 0",
      "attn(Q,K,V) = σ(QKᵀ/√d_k)V",
      "LoRA :: ΔW = B·A  (r=16, α=32)",
    ],
    tint: "rgba(250, 246, 232, 0.65)",
  },
  {
    lines: [
      "w* = argmin_w ∑ L(y_i, ∑ α_m h_m(x_i))",
      "blend = 0.42·deberta + 0.35·lgbm + 0.23·cat",
      "shakeup_risk : LOW (CV ↔ LB ρ = 0.96)",
    ],
    tint: "rgba(253, 224, 71, 0.62)",
  },
  {
    lines: [
      "  10110 01101 11010",
      "01011  [GPU:0 A100]  10101",
      "  loss: 0.0318 ──► 0.0194",
    ],
    tint: "rgba(125, 211, 252, 0.62)",
  },
  {
    lines: [
      "StratifiedGroupKFold(n_splits=5)",
      "├─ fold_0: 0.8914  ├─ fold_1: 0.8931",
      "└─ fold_2: 0.8908  └─ mean  : 0.8921",
    ],
    tint: "rgba(167, 243, 208, 0.64)",
  },
  {
    lines: [
      "ℒ_focal = -α_t (1 - p_t)^γ log(p_t)",
      "EMA(θ_t) = 0.999·θ_{t-1} + 0.001·θ_t",
      "cosine_lr(η_max=2e-4, warmup=500)",
    ],
    tint: "rgba(250, 246, 232, 0.58)",
  },
  {
    lines: [
      "⟦ KAGGLE · DRIVENDATA · AICROWD · ZINDI ⟧",
      "  prize_pool_usd >= $5,700,000",
      "  refresh_cron   : 0 6 * * * UTC",
    ],
    tint: "rgba(251, 191, 36, 0.6)",
  },
  {
    lines: [
      "      ╱╲      ╱╲",
      "  ───╱──╲────╱──╲───► t",
      "  fft_spec(x) ∈ ℝ^{F×T}",
    ],
    tint: "rgba(110, 231, 183, 0.58)",
  },
];

export function AsciiBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const clusters: Cluster[] = ML_ASCII_CLUSTERS.map((c, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      return {
        x: ((col + 0.5) / 3) * width + (Math.random() - 0.5) * 140,
        y: ((row + 0.45) / 3) * height + (Math.random() - 0.5) * 90,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.14,
        lines: c.lines,
        tint: c.tint,
        alpha: 0.22 + (i % 3) * 0.06,
        phase: i * 1.15,
      };
    });

    let tick = 0;
    const render = () => {
      tick += 0.012;
      ctx.clearRect(0, 0, width, height);
      ctx.font = '11px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textBaseline = "top";

      for (const cl of clusters) {
        if (!reducedMotion) {
          cl.x += cl.vx;
          cl.y += cl.vy;
          if (cl.x < -180) cl.x = width + 60;
          if (cl.x > width + 120) cl.x = -140;
          if (cl.y < -80) cl.y = height + 40;
          if (cl.y > height + 80) cl.y = -60;
        }

        const pulse = 0.78 + 0.22 * Math.sin(tick + cl.phase);
        const alpha = cl.alpha * pulse;

        // Soft atmospheric halo behind each ASCII cluster (wundernn.io signature)
        const grad = ctx.createRadialGradient(cl.x + 70, cl.y + 20, 4, cl.x + 70, cl.y + 20, 135);
        grad.addColorStop(0, `rgba(16, 48, 38, ${alpha * 0.95})`);
        grad.addColorStop(0.55, `rgba(12, 28, 23, ${alpha * 0.45})`);
        grad.addColorStop(1, "rgba(8, 14, 12, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cl.x + 70, cl.y + 20, 135, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = cl.tint;
        cl.lines.forEach((line, idx) => {
          ctx.fillText(line, cl.x, cl.y + idx * 15);
        });
        ctx.restore();
      }

      if (!reducedMotion) {
        animId = window.requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animId) window.cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none" aria-hidden="true">
      {/* Deep atmospheric organic/neural bokeh background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 18%, rgba(28, 72, 56, 0.42) 0%, transparent 46%), radial-gradient(circle at 82% 24%, rgba(74, 107, 62, 0.28) 0%, transparent 48%), radial-gradient(circle at 52% 78%, rgba(20, 83, 65, 0.34) 0%, transparent 55%), linear-gradient(180deg, #0b110e 0%, #0e1713 48%, #090e0c 100%)",
        }}
      />
      {/* Subtle film grain + scanline grid texture */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(250,246,232,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(250,246,232,0.18) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Drifting ML math & ASCII canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-90" />
    </div>
  );
}

