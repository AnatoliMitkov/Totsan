import TotsanSelect from '../ui/TotsanSelect.jsx'

export function ProfileWorkspaceSurface({ as: Component = 'section', className = '', children, ...props }) {
  return (
    <Component {...props} className={`rounded-3xl border border-line bg-paper p-5 md:p-6 ${className}`.trim()}>
      {children}
    </Component>
  )
}

export function ProfileWorkspaceSectionHeader({ eyebrow = '', title, description = '', action = null }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="mt-2 font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.05] text-ink">{title}</h2>
        {description && <p className="mt-2 text-sm leading-6 text-muted md:text-[15px]">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export default function ProfileWorkspaceShell({
  banner,
  header,
  notices = null,
  navGroups = [],
  activeTab,
  onTabChange,
  contentRef,
  sidebarFooter = null,
  children,
}) {
  const tabs = navGroups.flatMap((group) => group.tabs.map((tab) => ({ ...tab, groupLabel: group.label })))
  const mobileOptions = tabs.map((tab) => ({ value: tab.id, label: `${tab.groupLabel} · ${tab.label}` }))

  return (
    <>
      {banner}
      <div className="relative z-10 flow-root bg-soft pb-10">
        <div className="container-page -mt-10 w-full !max-w-[100rem] space-y-5 px-4 sm:-mt-12 md:-mt-[17.5rem] md:px-6 lg:-mt-[20rem] lg:space-y-5 xl:-mt-[13.25rem]">
          {header}
          {notices}

          <div className="lg:hidden">
            <ProfileWorkspaceSurface className="p-3 md:p-3">
              <TotsanSelect
                ariaLabel="Избери секция от профила"
                value={activeTab}
                onChange={onTabChange}
                options={mobileOptions}
                buttonClassName="bg-soft/70"
              />
            </ProfileWorkspaceSurface>
          </div>

          <div className="grid min-w-0 gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
            <aside className="sticky top-[calc(var(--header-h,64px)+1rem)] hidden rounded-3xl border border-line bg-paper p-3 lg:block">
              <nav aria-label="Секции на партньорския профил" className="space-y-4">
                {navGroups.map((group) => (
                  <div key={group.id}>
                    <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{group.label}</div>
                    <div className="grid gap-1">
                      {group.tabs.map((tab) => {
                        const Icon = tab.icon
                        const selected = activeTab === tab.id
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => onTabChange(tab.id)}
                            aria-current={selected ? 'page' : undefined}
                            className={`flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accentDeep/25 ${selected ? 'bg-ink text-paper' : 'text-muted hover:bg-soft hover:text-ink'}`}
                          >
                            <Icon size={17} aria-hidden="true" />
                            <span className="min-w-0 flex-1">{tab.label}</span>
                            {tab.badge ? <span className={`rounded-full px-2 py-0.5 text-[11px] ${selected ? 'bg-paper/15 text-paper' : 'bg-accentSoft text-accentDeep'}`}>{tab.badge}</span> : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </nav>
              {sidebarFooter ? <div className="mt-4 border-t border-line pt-4">{sidebarFooter}</div> : null}
            </aside>

            <section ref={contentRef} aria-label="Съдържание на избраната профилна секция" className="min-w-0 space-y-5">
              {children}
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
