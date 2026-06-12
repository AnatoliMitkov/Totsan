import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const STREAM_URL = 'https://connector.eagle3dstreaming.com/v5/Totsan/TotsanDesignSystem/No_Mouse'
const DESKTOP_BREAKPOINT = 1280

export default function Vizualizacia() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= DESKTOP_BREAKPOINT
  })
  const [isStreaming, setIsStreaming] = useState(false)
  const [isFrameLoading, setIsFrameLoading] = useState(false)
  const [sessionSeconds, setSessionSeconds] = useState(0)

  useEffect(() => {
    const syncViewport = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => {
    if (!isStreaming) return undefined

    const intervalId = window.setInterval(() => {
      setSessionSeconds((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isStreaming])

  useEffect(() => {
    if (isDesktop || !isStreaming) return

    setIsStreaming(false)
    setIsFrameLoading(false)
    setSessionSeconds(0)
  }, [isDesktop, isStreaming])

  function startStreaming() {
    setSessionSeconds(0)
    setIsFrameLoading(true)
    setIsStreaming(true)
  }

  function stopStreaming() {
    setIsStreaming(false)
    setIsFrameLoading(false)
    setSessionSeconds(0)
  }

  return (
    <section className="section">
      <div className="container-page">
        {!isDesktop ? (
          <div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-line bg-paper shadow-[0_30px_90px_-55px_rgba(13,35,64,0.35)]">
            <div className="relative overflow-hidden border-b border-line bg-[linear-gradient(135deg,rgba(11,31,56,0.98),rgba(23,63,105,0.94)_52%,rgba(198,228,255,0.65))] px-6 py-10 text-paper md:px-10 md:py-14">
              <div className="absolute inset-y-0 right-[-6rem] w-72 rounded-full bg-paper/10 blur-3xl" aria-hidden="true" />
              <div className="relative max-w-2xl">
                <div className="eyebrow text-paper/70">Unreal Engine x Eagle3D</div>
                <h1 className="mt-3 font-display text-[clamp(2.2rem,1.9rem+1vw,3.4rem)] leading-[0.98]">
                  3D визуализация на живо
                </h1>
                <p className="mt-4 text-sm text-paper/80 md:text-base">
                  3D визуализацията е оптимизирана за десктоп. Работим по мобилна версия.
                </p>
              </div>
            </div>

            <div className="space-y-5 p-6 md:p-8">
              <div className="rounded-[1.6rem] border border-line bg-soft/50 p-5">
                <div className="eyebrow">Достъп</div>
                <p className="mt-3 text-sm text-muted">
                  На mobile и tablet не зареждаме стрийм прозореца, за да избегнем слаб UX и ненужно стартиране на сесия.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link to="/start" className="btn btn-primary">Опиши проекта</Link>
                <Link to="/katalog" className="btn btn-ghost">Към каталога</Link>
              </div>
            </div>
          </div>
        ) : (
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-line bg-paper shadow-[0_30px_90px_-55px_rgba(13,35,64,0.35)]">
          <div className="relative overflow-hidden border-b border-line bg-[linear-gradient(135deg,rgba(11,31,56,0.98),rgba(23,63,105,0.94)_52%,rgba(198,228,255,0.65))] px-6 py-10 text-paper md:px-10 md:py-14">
            <div className="absolute inset-y-0 right-[-6rem] w-72 rounded-full bg-paper/10 blur-3xl" aria-hidden="true" />
            <div className="relative max-w-4xl">
              <div className="eyebrow text-paper/70">Unreal Engine x Eagle3D</div>
              <h1 className="mt-3 font-display text-[clamp(2.4rem,2rem+1.4vw,4rem)] leading-[0.98]">
                3D визуализация на живо
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-paper/78 md:text-base">
                Разгледай интерактивна Unreal Engine визуализация директно в браузъра. Тази сесия се стартира само при желание,
                а когато приключиш можеш веднага да я прекратиш, за да не се използват излишни ресурси.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-xs text-paper/82 md:text-sm">
                <span className="rounded-full border border-paper/20 bg-paper/10 px-3 py-2">Сесията се стартира само след натискане.</span>
                <span className="rounded-full border border-paper/20 bg-paper/10 px-3 py-2">Затвори визуализацията, когато приключиш.</span>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6 md:p-8 lg:p-10">
            <div className="rounded-[1.8rem] border border-line bg-soft/30 p-3 md:p-4 lg:p-5">
              <div className="aspect-video overflow-hidden rounded-[1.35rem] border border-line bg-ink/95 shadow-[0_26px_70px_-40px_rgba(6,15,28,0.78)]">
                {isStreaming ? (
                  <div className="relative h-full w-full">
                    {isFrameLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/70 px-6 text-center text-sm text-paper">
                        Свързваме Unreal сесията...
                      </div>
                    )}
                    <iframe
                      key="eagle3d-stream"
                      src={STREAM_URL}
                      title="Totsan 3D Visualization"
                      allow="fullscreen; autoplay; microphone; clipboard-read; clipboard-write; gamepad"
                      allowFullScreen
                      className="h-full w-full border-0"
                      onLoad={() => setIsFrameLoading(false)}
                    />
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center text-paper md:px-10">
                    <div className="text-xs uppercase tracking-[0.25em] text-paper/55">Preview</div>
                    <div className="mt-4 max-w-2xl font-display text-[clamp(2rem,1.5rem+1.4vw,4rem)] leading-[1.02]">
                      Премиум 3D сесия по заявка
                    </div>
                    <p className="mt-4 max-w-2xl text-sm text-paper/72 md:text-base">
                      Потокът не се зарежда автоматично. Стартира се само когато наистина искаш да влезеш във визуализацията.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-line bg-paper p-5 md:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="eyebrow">Сесия</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${isStreaming ? 'bg-green-100 text-green-800' : 'bg-soft text-muted'}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${isStreaming ? 'bg-green-600' : 'bg-line'}`} />
                      {isStreaming ? 'Активна сесия' : 'Сесията е изключена'}
                    </span>
                    <span>Таймер: {formatSessionTime(sessionSeconds)}</span>
                  </div>
                </div>

                {isStreaming ? (
                  <button type="button" onClick={stopStreaming} className="btn btn-ghost self-start lg:self-auto">
                    Прекрати сесията
                  </button>
                ) : (
                  <button type="button" onClick={startStreaming} className="btn btn-primary self-start lg:self-auto">
                    Стартирай 3D визуализация
                  </button>
                )}
              </div>

              <p className="mt-4 text-sm text-muted">
                Натисни ESC, за да излезеш от визуализацията.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-[1.6rem] border border-line bg-soft/50 p-5">
                <div className="eyebrow">Какво е това</div>
                <p className="mt-3 text-sm text-muted">
                  Самостоятелна интерактивна сцена за представяне на пространство, материали и атмосфера в по-реалистична среда от статични рендъри.
                </p>
              </div>

              <div className="rounded-[1.6rem] border border-line bg-soft/50 p-5">
                <div className="eyebrow">Кога да я ползваш</div>
                <p className="mt-3 text-sm text-muted">
                  Когато искаш да покажеш идея по-впечатляващо, да разходиш клиент през сцена или да валидираш усещане преди следваща стъпка по проекта.
                </p>
              </div>

              <div className="rounded-[1.6rem] border border-line bg-soft/50 p-5">
                <div className="eyebrow">След това</div>
                <p className="mt-3 text-sm text-muted">
                  Ако искаш да превърнем визуализацията в реален проектен бриф, можеш да продължиш към guided flow-а.
                </p>
                <Link to="/start" className="btn btn-ghost mt-4">
                  Опиши проекта
                </Link>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </section>
  )
}

function formatSessionTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
