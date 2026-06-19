import { usePreset, PRESETS } from "./hooks/usePreset";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { Field } from "./components/Field";

export default function App() {
  const { preset, setPreset, theme, toggleTheme } = usePreset();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="sticky top-0 z-50 flex flex-wrap items-center gap-3 px-6 py-3 bg-[var(--color-surface)] border-b-[1.5px] border-[var(--color-border)]">
        <span className="type-label text-[var(--color-text-muted)]">Preset</span>
        <div className="flex border-[1.5px] border-[var(--color-border)] rounded-[var(--radius-button)] overflow-hidden">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              aria-pressed={preset === p}
              className={
                "px-3 py-1 text-sm font-[var(--font-body)] cursor-pointer [transition:background-color_var(--duration-instant)_var(--ease-signature)] " +
                (preset === p
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                  : "bg-transparent text-[var(--color-text-muted)]")
              }
            >
              {p}
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={toggleTheme} className="ml-auto">
          {theme === "light" ? "切到暗色" : "切到亮色"}
        </Button>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 py-16">
        <section
          className="grid gap-12 items-end mb-14"
          style={{ gridTemplateColumns: "5fr 3fr" }}
        >
          <div>
            <span className="eyebrow inline-block mb-3 px-3 py-1 border-[1.5px] border-[var(--color-border)] rounded-[var(--radius-full)] type-label">
              {preset} · {theme}
            </span>
            <h1 className="type-display">不撞脸的设计，<br />从拒绝默认值开始</h1>
            <p className="type-body mt-4 max-w-[46ch] text-[var(--color-text-muted)]">
              这是接好设计语言的 React + Tailwind 脚手架。切换上面的 preset 看四套风格——骨架不变，气质全变。
            </p>
            <div className="flex gap-3 mt-6 flex-wrap">
              <Button variant="cta">开始使用</Button>
              <Button variant="ghost">查看文档</Button>
            </div>
          </div>
          <div className="pb-2 pl-4 border-l-2 border-[var(--color-accent)]">
            <div className="type-body-sm">圆角分级 · 招牌缓动 · 标题 ≤ 600</div>
          </div>
        </section>

        <section className="mb-14">
          <h2 className="type-h2 mb-5 pb-2 border-b-[1.5px] border-[var(--color-border)]">卡片</h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
            <Card tag="主推">
              <div className="type-mono text-3xl text-[var(--color-accent)] leading-none">01</div>
              <h3 className="type-h3 mt-3 mb-2">共享 DNA</h3>
              <p className="type-body-sm text-[var(--color-text-muted)]">
                间距、圆角、动效、排版逻辑恒定不变。
              </p>
            </Card>
            <Card>
              <div className="type-mono text-3xl text-[var(--color-accent)] leading-none">02</div>
              <h3 className="type-h3 mt-3 mb-2">可切 Preset</h3>
              <p className="type-body-sm text-[var(--color-text-muted)]">按项目换表层。</p>
            </Card>
            <Card>
              <div className="type-mono text-3xl text-[var(--color-accent)] leading-none">03</div>
              <h3 className="type-h3 mt-3 mb-2">喂给 AI</h3>
              <p className="type-body-sm text-[var(--color-text-muted)]">改变输出分布。</p>
            </Card>
          </div>
        </section>

        <section className="mb-14">
          <h2 className="type-h2 mb-5 pb-2 border-b-[1.5px] border-[var(--color-border)]">表单</h2>
          <form className="grid gap-4 max-w-[420px]" onSubmit={(e) => e.preventDefault()}>
            <Field label="邮箱" type="email" placeholder="you@example.com" />
            <Field label="昵称" placeholder="看 focus ring 的颜色" />
            <div className="flex gap-3">
              <Button variant="primary">提交</Button>
              <Button variant="ghost">取消</Button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="type-h2 mb-5 pb-2 border-b-[1.5px] border-[var(--color-border)]">排版</h2>
          <div className="grid gap-3">
            <div className="type-display">Display 大标题</div>
            <div className="type-h1">H1 一级标题</div>
            <div className="type-h2">H2 二级标题</div>
            <div className="type-body">
              Body 正文：靠字号和行高扛视觉重量，不靠加粗。标题 weight 最高 600，绝不 700。
            </div>
            <div className="type-mono">type-mono · const designLanguage = "mine";</div>
          </div>
        </section>
      </main>
    </div>
  );
}
