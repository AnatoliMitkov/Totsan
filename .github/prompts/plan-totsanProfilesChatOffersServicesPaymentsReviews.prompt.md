# План: Totsan V2 — Профили v2, Чат, Оферти, Партньорски услуги, Плащания, Отзиви

## TL;DR
Цел: превръщаме статичните профили в **жива екосистема с пакетни партньорски услуги, адаптирана към 5-слойния модел на Totsan**. Клиентите получават богат личен профил с „проект-паспорт" (помещение, идея, слой, медии, прогрес %), специалистите получават модерен профил с портфолио, статистики и публикации/услуги с пакети, а двете страни общуват в realtime чат, в който се правят и приемат оферти. Плащанията минават през сайта (mock сега → Stripe Connect накрая) и отключват verified отзиви. Админ панелът се преработва, за да модерира всичко това. Изпълнението е стриктно фазирано — 7 фази, всяка със собствени DB миграции, RLS, UI, тестове и чек-пойнт за визуален преглед на localhost.

---

## Контекст (състояние към 04.05.2026)

**Какво има днес:**
- `auth.users` + публична таблица `public.accounts` (роля: `user` / `specialist` / `admin`, статус за specialist: `pending` / `approved` / `rejected`). Trigger `handle_new_user` авто-създава ред при signup, като чете `role` от `raw_user_meta_data`.
- `public.profiles` — публични карти на специалисти (slug, layer_slug, name, tag, city, since, rating, projects, bio, image\_\*). RLS позволява публичен прочит при `is_published=true`, на собственика — пълен контрол върху своя ред, на админите — всичко.
- `public.partner_applications` — заявки за специалист.
- `public.inquiries` — еднократни запитвания от форми.
- Buckets: `profile-images` (legacy, пряк upload) и `profile-images-optimized` (нов, чрез Edge Function `profile-media-upload`).
- Страници: `src/pages/MyProfile.jsx` (клиент: само email + тип акаунт + бутон „Стани партньор"; специалист: ProEditor с име/таг/град/био/снимка), `src/pages/Admin.jsx` (списък с inquiries/applications/profiles), `src/pages/Pro.jsx` (публична карта на специалист), `src/components/admin/ProfileManager.jsx`.
- 5-слойна структура: `src/data/layers.js` (LAYERS — slug, number, title, process, products, faq, showcase).
- Quiz engine: `src/components/quiz/quiz-engine.js` + конфигурации за бои/плочки/настилки/дограма.

**Какво липсва (адресира се от плана):**
- Клиентски профил като персонална стая (телефон, локация, аватар, медии за помещението, бюджет, текущ слой, „моят проект" с прогрес %).
- Партньорски профил v2 (портфолио галерия, статистики, отговорност, цени, локация, езици, „член от").
- Партньорски услуги / публикации с пакети Basic/Standard/Premium.
- Realtime чат (1↔1) между клиент и партньор + оферти като структурирани съобщения.
- Поръчки (orders) + escrow-style mock плащане → Stripe Connect.
- Verified отзиви, обвързани с приета оферта.
- Админ v2 — модерация на партньорски услуги, спорове, статистики.
- Известия (in-app + имейл) и unread badges.

---

## Архитектурни принципи (важат за всички фази)

1. **Supabase first.** Всички нови таблици — в `public`, с RLS от деня на създаване. Edge Functions само за: (а) операции, изискващи `service_role` (плащания, модерация, нотификации), (б) image processing, (в) уебхуци (Stripe).
2. **Никакви статични данни.** Всичко динамично от БД, с loading/empty states. Мокнатите стойности в `STATIC_PROFILES` (`src/lib/profiles.js`) остават празен масив.
3. **Реусване на съществуващото.** `useAccount`, `normalizeProfile`, `PROFILE_SELECT_COLUMNS`, `uploadProfileMedia` и LAYERS не се пренаписват — само се разширяват.
4. **Адаптивен UI.** Spacing/типография — `clamp()`, `vw`, `rem`, токени от `tailwind.config.js`. Никакви фиксирани px по подразбиране.
5. **Български по подразбиране** за UI copy, в стила на сайта (тон като текущите страници — топъл, ясен, кратък).
6. **Backwards compatible миграции.** Само `add column if not exists`, нови таблици с `if not exists`. Никога drop на съществуващо без явно решение.
7. **Defense in depth срещу off-platform контакти.** Чатът автоматично маскира телефони/имейли/линкове в съобщенията, придружено с предупреждение „Извън платформата нямаме отговорност".
8. **Phased delivery.** Една фаза = една PR-група. Не започваме N+1 преди визуален review на N от потребителя на localhost.

---

# Фаза 1 — Клиентски профил v2 („Моят проект")

**Цел:** клиентът има богат персонален профил, който описва него и проекта му — за да могат партньорите да оферират смислено без да задават едни и същи въпроси.

## 1.1 DB промени (в `supabase/schema.sql`, нов раздел в края)

Нови колони в `public.accounts`:
- `phone text`
- `avatar_url text`
- `city text`
- `country text default 'BG'`
- `bio text` (кратко „за мен")
- `locale text default 'bg'`
- `marketing_opt_in boolean default false`

Нова таблица `public.client_projects` (един клиент → 1..N проекта; в първа итерация показваме „активен" проект, но схемата подкрепя няколко):
- `id uuid pk`, `user_id uuid → auth.users on delete cascade`
- `title text` (напр. „Двустаен в Лозенец")
- `property_type text check in ('apartment','house','office','commercial','outdoor','other')`
- `area_sqm numeric(7,2)`
- `rooms_count int`
- `address_city text`, `address_region text`
- `current_layer_slug text` (към `LAYERS.slug` — 01..05)
- `desired_start_date date`
- `budget_min int`, `budget_max int`, `budget_currency text default 'EUR'`
- `idea_description text` (свободен текст за визията)
- `quiz_answers jsonb` (резултати от 5-слойните quiz-ове)
- `is_active boolean default true`, timestamps
- RLS: собственикът — пълен контрол; партньорите четат **само** проекти на клиенти, с които имат отворен разговор (виж Фаза 4); админите — всичко.

Нова таблица `public.client_project_media`:
- `id`, `project_id uuid → client_projects on delete cascade`, `user_id`
- `bucket text default 'project-media'`, `path text`, `public_url text`
- `kind text check in ('photo','plan','inspiration','document')`
- `caption text`, `order_index int default 0`, `created_at`
- RLS: собственикът пълен; партньори с активен разговор — read; админ — all.

Нов bucket `project-media` (private), нов слот в Edge Function `profile-media-upload` (или нова функция `project-media-upload`) за оптимизация и upload през service role.

Изчислимо поле „Профил попълнен %": клиентски calculator в JS (виж 1.3); опционално persisted view `vw_client_profile_completeness`.

## 1.2 Файлове за модификация / създаване

- `supabase/schema.sql` — добавки.
- `src/pages/MyProfile.jsx` — преработка на клиентския клон (`CustomerProfile` → нов layout с табове).
- Нов `src/components/profile/CustomerHeader.jsx` — аватар + име + „член от {date}" + completeness ring.
- Нов `src/components/profile/CustomerOverview.jsx` — съмари + бързи действия.
- Нов `src/components/profile/CustomerPersonal.jsx` — форма за лични данни (име, телефон, град, държава, аватар, кратко био).
- Нов `src/components/profile/CustomerProject.jsx` — форма за активния проект + upload на медии + layer picker.
- Нов `src/components/profile/CompletenessBar.jsx` — визуален progress bar с чек-листа.
- Нов `src/lib/projects.js` — fetch/update/upsert на `client_projects` + completeness калкулатор.
- Разширяване на `src/lib/profile-media-upload-client.js` или нов `src/lib/project-media-upload-client.js`.
- Reuse: `LAYERS` от `src/data/layers.js`.

## 1.3 UX поток

Когато клиент отвори `/moy-profil`:
- **Хедър:** аватар (с кадриране като в ProEditor), име, „В Totsan от {created_at}", completeness кръг (%).
- **Табове:** Преглед / Лични данни / Моят проект / Активност.
- **Преглед:** бързи карти („Попълни проекта си — +25%", „Добави снимки на помещението — +10%", „Свържи се със специалист от Слой {current_layer}"), CTA към „Намери специалист".
- **Лични данни:** редактируеми полета, snapshot на email (не се редактира), бутон „Запази".
- **Моят проект:** wizard-стил форма (тип помещение, кв.м., стаи, локация, бюджет, текущ слой, идея в свободен текст), drag&drop upload на снимки/планове/inspiration; всяка снимка с кратко описание; бутон „Премини quiz за {layer}" пуска съществуващия quiz и записва резултата в `quiz_answers`.
- **Completeness калкулатор** (тегла подлежат на промяна):
  - Аватар (5%), име (5%), телефон (10%), град (5%), bio (5%) → 30% лични
  - Активен проект със заглавие (5%), тип помещение (5%), кв.м. (5%), бюджет (5%), идея ≥80 знака (10%), текущ слой (5%), ≥3 снимки (15%), quiz попълнен (15%), адрес (5%) → 70% проект
- **Активност:** „Регистриран на …", „Запитвания изпратени: N", „Активни разговори: N" (последните две — попълват се от Фаза 4; преди това — placeholder „Скоро").

## 1.4 Стъпки за изпълнение
1. SQL миграция (нови колони, таблици, bucket, RLS).
2. `src/lib/projects.js` + uploader.
3. CompletenessBar + Header компонент.
4. Табове и празни форми.
5. Свързване с Supabase (read/write).
6. Quiz интеграция → запис в `quiz_answers`.
7. Локализация на копи + responsive проверка.

## 1.5 Приемни критерии
- Нов клиентски акаунт вижда празен профил с конкретни next-steps и 0% completeness.
- Попълването на всяко поле увеличава прогреса в реално време.
- Качването на снимки минава през Edge Function (никакъв пряк write от браузъра).
- Refresh на страницата запазва всичко.
- RLS: чужд клиент не може да чете/пише по моя проект (тествано с втори акаунт).

## 1.6 Верификация
- Manual: 2 клиентски акаунта, кросс-проверка (cannot read each other's projects).
- SQL: `select * from client_projects where user_id != auth.uid()` връща празно за authenticated.
- Lighthouse mobile ≥ 85 на `/moy-profil`.
- Visual review checkpoint от потребителя на localhost.

---

# Фаза 2 — Партньорски профил v2

**Цел:** модерен, „живи" партньорски профили с портфолио, статистики, отговорност и locale, които ясно сигнализират професионализъм.

## 2.1 DB промени

Разширяване на `public.profiles`:
- `headline text` (по-кратко от `tag`, тип „One-liner")
- `description_long text` (богато био, отделно от автогенерираното `bio`)
- `phone text`, `email_public text` (опционално, ако партньорът иска)
- `website text`, `instagram text`, `facebook text`
- `languages text[] default '{bg}'`
- `service_areas text[]` (списък градове/региони)
- `years_experience int`
- `response_time_hours int` (агрегира се от чата след Фаза 4; default null)
- `accepts_remote boolean default false`
- `pricing_note text` (типичен ценови диапазон, свободен текст)

Нова таблица `public.profile_portfolio`:
- `id`, `profile_id uuid → profiles on delete cascade`
- `title text`, `description text`
- `cover_url text`, `media jsonb` (масив от {url, caption})
- `layer_slug text`, `year int`, `city text`, `budget_band text`
- `order_index int`, `is_published bool default true`, timestamps
- RLS: публичен read за `is_published=true`; собственикът — пълен; админ — всичко.

Нов bucket `portfolio-media` (public), upload през Edge Function.

Агрегатна view `vw_profile_stats`:
- `total_projects` (брой портфолио + поле `projects` от profile)
- `active_orders`, `completed_orders` (от Фаза 6)
- `avg_rating`, `reviews_count` (от Фаза 7)
- `member_since` = `profiles.created_at` или `accounts.created_at`

## 2.2 Файлове

- `supabase/schema.sql` — миграции.
- Преработка на `src/pages/MyProfile.jsx → ProEditor` или extract в `src/components/profile/ProEditor.jsx` с табове: Преглед / Профил / Портфолио / Услуги (празно за Фаза 2, активира се във Фаза 5) / Контакт.
- `src/pages/Pro.jsx` — обогатяване с нови секции (about, портфолио галерия, статистики, локации, езици, контакт).
- Нов `src/components/profile/PortfolioGallery.jsx` (lightbox с keyboard nav).
- Нов `src/components/profile/PartnerStats.jsx`.
- Нов `src/lib/portfolio.js` (CRUD + upload).
- Reuse `getProfileImage`, `getProfileImageStyle`.

## 2.3 UX
- Sticky CTA в публичния профил: „Свържи се" → отваря чат (Фаза 4) или fallback inquiry форма докато чатът не е готов.
- Statistics карта: „Член от 2024 · 12 проекта · ⌀ отговор < 4ч · 4.9★ (23)".
- Портфолио = grid с cover, click → lightbox с описание, локация, година, слой.

## 2.4 Стъпки
1. Миграции + RLS.
2. Portfolio uploader + Edge Function слот.
3. ProEditor v2 (табове + редактиране на новите полета).
4. Public Pro page rebuild.
5. Stats view + интеграция в UI (с „—" за метрики, които ще се напълнят след следващите фази).

## 2.5 Приемни критерии
- Партньор може да добави ≥10 портфолио елемента, всеки със заглавие, обложка, медии, мета.
- Публичният профил показва всички нови полета адаптивно (mobile/desktop).
- RLS: само собственикът може да edit-не своя `profile`/`portfolio`.

---

# Фаза 3 — Админ панел v2

**Цел:** контрол, видимост, бързодействие. Админът модерира потребители, партньорски услуги (Фаза 5), оферти, спорове, плащания.

## 3.1 DB промени
- `public.audit_log` (id, actor_id, action, entity_type, entity_id, payload jsonb, created_at) — за следене на админски действия.
- View `vw_admin_dashboard` (брой нови регистрации/24ч, отворени спорове, чакащи specialist applications, нови услуги за модерация и т.н.).
- Полета за модерация в бъдещи таблици (`partner_services.moderation_status`, `reviews.moderation_status`).

## 3.2 Файлове
- `src/pages/Admin.jsx` — преработка в shell с lazy-loaded подсекции.
- `src/components/admin/Dashboard.jsx` — нов; KPI карти, графики (recharts или просто числа в първа итерация).
- `src/components/admin/UsersManager.jsx` — нов; списък акаунти с филтри по роля/статус, действия (одобри/отхвърли specialist, ban, reset).
- `src/components/admin/InquiriesManager.jsx` — extract от текущия `Dashboard`.
- `src/components/admin/ApplicationsManager.jsx` — extract.
- `src/components/admin/ProfileManager.jsx` — съществуващ, малки UX подобрения.
- `src/components/admin/PartnerServicesManager.jsx` (Фаза 5).
- `src/components/admin/OrdersManager.jsx` (Фаза 6).
- `src/components/admin/ReviewsManager.jsx` (Фаза 7).
- `src/components/admin/AuditLog.jsx`.
- `src/lib/admin.js` — централизирани заявки + audit logging helper.

## 3.3 UX
- Лява навигация (sticky), top bar с глобално търсене, табове по секция.
- Всяка таблица — pagination, search, filter chips, bulk actions.
- Edge Function `admin-action` за чувствителни мутации (одобрение, ban, refund) с автоматичен audit запис.

## 3.4 Стъпки и критерии
1. Audit таблица + helper.
2. Shell + Dashboard.
3. UsersManager (одобрение на specialist + role промяна — service-role през Edge Function, защото RLS не позволява).
4. Refactor на съществуващите секции.
5. Visual review.

---

# Фаза 4 — Чат + оферти в чата

**Цел:** Realtime 1↔1 разговори между клиент и партньор; оферти и приемането им се случват вътре в чата като структурирани съобщения. Гарантираме доверие чрез „in-platform only" политика.

## 4.1 DB промени

`public.conversations`:
- `id uuid pk`, `client_id uuid`, `partner_id uuid`, `project_id uuid → client_projects` (nullable),
- `subject text`, `status text check in ('open','closed','blocked') default 'open'`
- `last_message_at timestamptz`, `last_message_preview text`
- `created_at`
- Уникалност: един активен `(client_id, partner_id, project_id)` (partial unique index).

`public.messages`:
- `id`, `conversation_id`, `sender_id`, `kind text check in ('text','offer','system','attachment')`
- `body text`, `attachments jsonb`, `offer_id uuid → offers` (nullable)
- `created_at`, `read_at` per recipient (отделна таблица `message_reads` или просто `is_read_by_client`/`is_read_by_partner` на `conversations` за прости unread badges).

`public.offers`:
- `id`, `conversation_id`, `partner_id`, `client_id`, `project_id`
- `title`, `description text`, `deliverables jsonb` (списък буллети)
- `price_amount int`, `currency default 'EUR'`, `delivery_days int`, `revisions int`
- `status text check in ('draft','sent','accepted','declined','withdrawn','expired') default 'sent'`
- `expires_at`, `accepted_at`, `created_at`
- Когато офертата се приеме → автоматично се създава `order` (Фаза 6).

RLS:
- `conversations`: read/write — само ако `auth.uid() in (client_id, partner_id)`; админ — all.
- `messages`: read/write — само ако `conversation.client_id = auth.uid() or conversation.partner_id = auth.uid()`.
- `offers`: създават се само от партньора (sender_id = partner_id); приемат се само от клиента.

Realtime: enable on `messages`, `conversations`, `offers`.

Edge Function `chat-send-message`:
- Маскира телефони (`/(\+?\d[\d\s().-]{6,})/g`), имейли, http(s) URL → `[скрито от Totsan — общувайте в платформата]`.
- Връща оригинала на изпращача като audit (но в `body` се пази само маскираното за защита).
- Rate limiting: 30 msg/min per user.

## 4.2 Файлове

- `supabase/schema.sql` — нови таблици + RLS + realtime publication.
- `supabase/functions/chat-send-message/index.ts` — нова.
- `src/pages/Inbox.jsx` — нова страница `/inbox` (списък разговори вляво, активен чат вдясно).
- `src/components/chat/ConversationList.jsx`, `ChatThread.jsx`, `MessageBubble.jsx`, `OfferCard.jsx`, `ComposeBar.jsx`, `OfferComposer.jsx`.
- `src/lib/chat.js` — fetch + realtime subscriptions + send.
- `src/pages/Pro.jsx` — бутон „Свържи се" → създава/отваря conversation и пренасочва към `/inbox/{id}`.
- `src/components/Layout.jsx` — добавяне на „Съобщения" линк с unread badge в навигацията за логнати потребители.
- `src/components/profile/CustomerOverview.jsx` (Фаза 1) — добавяне на „Активни разговори".

## 4.3 UX
- Inbox layout: вляво conversations с last message preview, time ago, unread dot; вдясно — message thread с auto-scroll.
- Партньорът има бутон „Изпрати оферта" в `ComposeBar` → отваря модал `OfferComposer` (заглавие, описание, доливърабли, цена, срок, ревизии) → изпраща `kind='offer'` съобщение, което рендерира `OfferCard`.
- Клиентът вижда `OfferCard` с бутони „Приеми" / „Откажи" / „Поискай промяна" (последното = текстов отговор).
- При натискане на „Приеми" — преди Фаза 6 се показва toast „Скоро ще можеш да платиш в сайта"; след Фаза 6 — отваря checkout flow.
- Trust banner на върха на всеки чат: „Сигурност на Totsan: разговори и плащания в платформата са защитени. Не споделяме контакти/външни линкове."
- Известия: in-app badge задължително; имейл нотификация за нови съобщения, ако получателят не е онлайн >5 мин (background job или Edge trigger).

## 4.4 Стъпки
1. SQL: таблици, RLS, индекси, realtime.
2. Edge Function за send + masking.
3. `chat.js` lib.
4. Inbox UI (без оферти).
5. Realtime subscriptions + unread.
6. OfferComposer + OfferCard + accept/decline (без плащане).
7. Trust banner + masking visual indicator.
8. Email нотификации (опционално в края).

## 4.5 Приемни критерии
- Двама потребители (клиент + партньор) виждат взаимни съобщения в реално време без refresh.
- Опит за пращане на телефон/имейл/линк → текстът се маскира видимо за получателя.
- RLS: трети акаунт не вижда нищо.
- Партньор може да изпрати оферта; клиент може да я приеме (статусът се променя).
- Unread badge в навбара е точен.

---

# Фаза 5 — Партньорски услуги / Публикации

**Цел:** партньорите създават продаваеми услуги с пакети Basic/Standard/Premium, медии и FAQ. Клиентите ги discover-ват от каталога и поръчват директно (или питат в чата).

## 5.1 DB промени

`public.partner_services`:
- `id`, `slug unique`, `partner_id`, `layer_slug`
- `title`, `subtitle`, `description_md text`
- `cover_url`, `media jsonb` (4-8 снимки/видео)
- `tags text[]`, `delivery_areas text[]`
- `is_published bool default false`, `moderation_status text check in ('draft','pending','approved','rejected') default 'draft'`
- `moderation_note text`
- timestamps

`public.partner_service_packages` (1..3 на услуга):
- `id`, `service_id`, `tier text check in ('basic','standard','premium')`
- `title`, `description text`, `features jsonb`
- `price_amount int`, `currency`, `delivery_days int`, `revisions int`
- `is_active bool default true`
- Уникалност: `(service_id, tier)`.

`public.partner_service_faq` — `id`, `service_id`, `question`, `answer`, `order_index`.

RLS: публичен read само за `is_published=true and moderation_status='approved'`; собственикът пълен; админ — всичко (вкл. модерация).

Bucket `service-media` (public), Edge Function за upload.

## 5.2 Файлове
- `src/pages/MyProfile.jsx → ProEditor` — нов таб „Моите услуги" с CRUD.
- `src/components/profile/PartnerServiceEditor.jsx` — wizard (info → packages → media → FAQ → preview → submit for review).
- `src/pages/PartnerService.jsx` — публична страница на услуга (`/uslugi/:slug`), 3 пакета в табове, „Поръчай" → води към checkout (Фаза 6) или „Питай първо" → отваря чат (Фаза 4).
- `src/pages/Catalog.jsx` — добавяне на „Услуги" tab освен „Специалисти" и „Продукти".
- `src/components/admin/PartnerServicesManager.jsx` — модерация (approve/reject + note).
- `src/lib/partner-services.js`.

## 5.3 UX
- PartnerServiceEditor wizard с live preview вдясно.
- Публичната услуга — hero с заглавие, cover, partner pill, 3 пакета като табове, „За услугата", FAQ accordion, секция „За партньора" (линк към профила), reviews (Фаза 7).
- Catalog filter: слой, цена, време за доставка, рейтинг.

## 5.4 Стъпки
1. Миграции + RLS + bucket.
2. PartnerServiceEditor + libs.
3. Public PartnerService page.
4. Catalog интеграция.
5. Admin модерация.
6. Submit-for-review flow (service → pending → одобрен/отхвърлен).

## 5.5 Приемни критерии
- Партньор създава услуга с 3 пакета → submit → видима в админа като pending → след approve → публична и discover-абъл в каталога.
- Без approve услугата не е публично достъпна (тестван с anon).

---

# Фаза 6 — Поръчки и плащания (mock → Stripe Connect)

**Цел:** „Приемам" офертата или „Поръчвам" услуга → клиентът плаща в сайта; парите се държат escrow-style; партньорът маркира работата като завършена; клиентът потвърждава и парите се освобождават. В първа итерация всичко работи с mock плащане; финално се закача Stripe Connect.

## 6.1 DB промени

`public.orders`:
- `id`, `client_id`, `partner_id`, `conversation_id` (nullable, ако е от чат-оферта), `service_id` (nullable), `service_package_id` (nullable), `offer_id` (nullable)
- `title`, `description`, `deliverables jsonb`
- `amount_total int`, `platform_fee int`, `partner_payout int`, `currency`
- `status text check in ('pending_payment','paid','in_progress','delivered','completed','disputed','refunded','cancelled')`
- `delivery_due_at`, `delivered_at`, `completed_at`, `created_at`
- `stripe_payment_intent_id text`, `stripe_transfer_id text` (nullable за mock)

`public.order_events` — audit lifecycle (status_change, message, refund_request, dispute).

`public.payment_transactions` — id, order_id, type (charge/payout/refund), provider (mock/stripe), amount, status, raw jsonb.

RLS: read/write само за участниците + админ.

Edge Function `payments-checkout`:
- Mock режим (флаг от env): създава `orders` row със статус `paid` директно.
- Stripe режим: създава Stripe Checkout Session с `application_fee_amount` и `transfer_data.destination = partner_stripe_account_id`.

Edge Function `payments-webhook` за Stripe събития (`payment_intent.succeeded`, `charge.refunded`, account events).

Нова колона `accounts.stripe_account_id text` за партньорите.

## 6.2 Файлове
- `src/pages/Checkout.jsx` (`/checkout/:type/:id`) — preview + бутон „Плати" (mock или Stripe).
- `src/pages/Order.jsx` (`/order/:id`) — статус, чат линк, бутон „Маркирай като завършено" (партньор), „Потвърди" (клиент), „Поискай ревизия".
- `src/pages/MyOrders.jsx` — списък поръчки на клиента.
- `src/components/profile/PartnerOrders.jsx` — таб в ProEditor.
- `src/components/admin/OrdersManager.jsx`.
- `src/lib/orders.js`, `src/lib/payments.js`.
- `supabase/functions/payments-checkout/index.ts`, `supabase/functions/payments-webhook/index.ts`.

## 6.3 UX
- Checkout: summary (заглавие, deliverables, цена, такса платформа, общо), copy „Плащаш сигурно през Totsan. Парите се освобождават след потвърждение."
- Order page: timeline на събитията, CTA според role + status.
- Partner onboarding към Stripe Connect — бутон „Активирай плащания" в ProEditor → Stripe Express onboarding link.

## 6.4 Стъпки
1. Миграции.
2. Mock checkout end-to-end (offer accepted → order paid → in_progress → delivered → completed).
3. UI: Checkout, Order, MyOrders, PartnerOrders.
4. Stripe интеграция (test mode): Connect account, Checkout Session, Webhook, payouts.
5. Refund/dispute flow (manual през админа в първа итерация).

## 6.5 Приемни критерии (mock)
- От offer accepted → автоматично се създава order със статус `paid`.
- Партньорът вижда поръчката, може да я маркира `delivered`.
- Клиентът потвърждава → `completed` и отключва ревю (Фаза 7).
- Всичко с RLS — друг потребител не вижда чужди поръчки.

## 6.6 Приемни критерии (Stripe)
- Тестов клиент с тестова карта плаща → webhook update-ва status → партньорът получава payout (test).
- Connect onboarding минава успешно за нов партньор.

---

# Фаза 7 — Verified отзиви и доверие

**Цел:** само клиенти с `completed` поръчка могат да оставят отзив за партньора. Рейтингите се агрегират в `vw_profile_stats` и се показват в профила и в услугите.

## 7.1 DB промени

`public.reviews`:
- `id`, `order_id unique` (един отзив на поръчка), `client_id`, `partner_id`, `service_id` (nullable)
- `rating_overall int check (rating_overall between 1 and 5)`
- `rating_communication int`, `rating_quality int`, `rating_value int`
- `body text`, `created_at`
- `partner_reply text`, `partner_reply_at`
- `moderation_status text check in ('visible','hidden') default 'visible'`

`public.review_reports` — id, review_id, reporter_id, reason, created_at, resolved_at.

RLS: insert само ако клиентът е собственик на `completed` order; публичен read за `moderation_status='visible'`.

Trigger: при insert/update на `reviews` → recalc на `profiles.rating` и `vw_profile_stats`.

## 7.2 Файлове
- `src/components/reviews/ReviewForm.jsx` — рендерира се на Order page след `completed`.
- `src/components/reviews/ReviewsList.jsx` — на Pro page и PartnerService page.
- `src/components/admin/ReviewsManager.jsx` — модерация / hide / resolve reports.
- `src/lib/reviews.js`.

## 7.3 UX
- Star rating widget с 4 категории + общ.
- На Pro/PartnerService: средна оценка + разпределение по звезди + последни 5 отзива + „Виж всички".
- Партньорът може да отговори веднъж на отзив.

## 7.4 Стъпки
1. Миграции + trigger за recalc.
2. ReviewForm.
3. ReviewsList в Pro/PartnerService.
4. Reports + admin modeartion.

## 7.5 Приемни критерии
- Без `completed` order → невъзможно да се остави ревю (UI скрит, БД отказва).
- Средната оценка се обновява автоматично.

---

## Cross-cutting задачи (вървят паралелно с фазите)

- **Известия:** in-app + имейл (Edge Function `send-email` + темплейти; SendGrid/Resend). Триггери: ново съобщение, нова оферта, статус на поръчка, нов отзив, partner application статус.
- **i18n инфраструктура:** UI копи в български. EN превод се добавя накрая (Фаза 7+).
- **Анализ:** track събития (signup, profile_completed, message_sent, offer_sent, offer_accepted, order_paid, order_completed, review_left).
- **Сигурност:** preset CSP headers, secure cookies за session, redaction в логовете.
- **Имейл/телефон верификация:** опционално двустепенна верификация на партньорите преди approval (Фаза 3).

---

## Файлове за докосване (overview)

- `supabase/schema.sql` — миграции за всяка фаза (адитивни секции в края, маркирани с коментар „-- Phase N").
- `supabase/functions/` — `chat-send-message`, `payments-checkout`, `payments-webhook`, `send-email`, `admin-action`, евентуално `service-media-upload`, `project-media-upload`.
- `src/pages/` — `MyProfile.jsx` (rebuild), `Admin.jsx` (rebuild), `Pro.jsx` (rebuild), нови: `Inbox.jsx`, `PartnerService.jsx`, `Checkout.jsx`, `Order.jsx`, `MyOrders.jsx`.
- `src/components/profile/`, `src/components/chat/`, `src/components/admin/`, `src/components/reviews/` — нови компоненти.
- `src/lib/` — `projects.js`, `portfolio.js`, `chat.js`, `partner-services.js`, `orders.js`, `payments.js`, `reviews.js`, `admin.js`, `notifications.js`.
- `src/components/Layout.jsx` — нав с „Съобщения" + unread badges.

---

## Верификация (на цялата система, end-to-end сценарии)

1. **Сценарий клиент.** Регистрация → попълва личен профил → създава проект (тип апартамент, 75 м², бюджет, идея, 5 снимки, текущ слой 03) → completeness ≥ 80% → намира услуга „Боядисване на стая" → пита партньора в чат → получава оферта 250 EUR → приема → плаща (mock) → получава „delivered" → потвърждава → пише ревю 5★. Целият път без грешки, без напускане на платформата.
2. **Сценарий партньор.** Регистрира се като specialist → попълва профил v2 + 5 портфолио → създава 1 услуга с 3 пакета → submit за review → админ approve → получава съобщение от клиент → изпраща оферта → офертата се приема → маркира delivered → получава payout (mock/test Stripe) → отговаря на ревю.
3. **Сценарий админ.** Вижда KPI dashboard → одобрява нов специалист → модерира услуга → решава dispute → пуска refund.
4. **Сигурност.** Опит за директен SQL/REST към чужди данни — отказ от RLS. Опит за пращане на телефон в чата — маскиране. Опит за плащане без auth — отказ.
5. **Регресия.** Старите страници (Home, Layer, Catalog, Service) продължават да работят.

---

## Решения и ограничения (за фиксиране пред Claude Opus)

- Mock плащане в Фаза 6.1; реален Stripe Connect в Фаза 6.4.
- Realtime чат с оферти като структурирани съобщения.
- Услуги с 3 пакета (Basic/Standard/Premium) задължително; партньорът избира кои да активира (≥1).
- Verified отзиви (само от клиенти с completed order).
- Български UI; английски — в по-късна фаза.
- Адитивни SQL миграции; никакви destructive промени без явно решение.
- Между всяка фаза — visual review checkpoint от потребителя на localhost.
- Edge Functions за всичко, изискващо service role.

---

## Допълнителни решения, които Claude Opus трябва да адресира при детайлния план

1. **Тарифи на платформата.** Препоръка: 10% commission върху order. (Алтернативи: 8% / 15% / split fee между клиент и партньор.)
2. **Частни/публични buckets.** Препоръка: `project-media` private (signed URLs за партньори с активен разговор), `portfolio-media` и `service-media` public.
3. **Маскиране на контакти.** Препоръка: client-side warning + server-side hard mask. (Алтернативи: само warning / shadow ban при многократни нарушения.)
4. **Лимит брой проекти на клиент.** Препоръка: 3 активни. (Алтернативи: 1 / неограничено.)
5. **Лимит услуги на партньор.** Препоръка: 5 в pending review + неограничено approved. (Алтернативи: 3 / 10.)
