export const SPECIALIST_TYPES = [
  { value: 'architect', label: 'Архитект', icon: '✏️' },
  { value: 'interior_designer', label: 'Интериорен дизайнер', icon: '🛋️' },
  { value: 'engineer', label: 'Проектант / Инженер', icon: '⚙️' },
  { value: '3d_visualizer', label: '3D визуализатор', icon: '🖥️' },
  { value: 'consultant', label: 'Консултант', icon: '🧭' },
]

export const SPECIFIC_SERVICES = [
  { value: 'concept', label: 'Идеен проект / Концепция' },
  { value: '3d', label: '3D визуализация' },
  { value: 'permits', label: 'Разрешителни и документация' },
  { value: 'survey', label: 'Заснемане и анализ' },
  { value: 'energy_audit', label: 'Енергиен одит' },
  { value: 'layout', label: 'Разпределение и функционален план' },
  { value: 'material_selection', label: 'Избор на материали' },
  { value: 'budget', label: 'Бюджетно планиране' },
  { value: 'legalization', label: 'Узаконяване' },
]

export const TARGET_OBJECTS = [
  { value: 'apartment', label: 'Апартамент', icon: '🏢' },
  { value: 'house', label: 'Къща', icon: '🏡' },
  { value: 'restaurant', label: 'Заведение', icon: '🍽️' },
  { value: 'office', label: 'Офис', icon: '🏛️' },
  { value: 'garden', label: 'Двор / Градина', icon: '🌿' },
  { value: 'shop', label: 'Магазин', icon: '🛍️' },
  { value: 'renovation', label: 'Преустройство', icon: '🔨' },
]

export const DELIVERABLES = [
  { value: 'blueprint', label: 'Чертежи / Планове' },
  { value: '3d_render', label: '3D визуализации' },
  { value: 'pdf_concept', label: 'PDF концепция' },
  { value: 'budget_estimate', label: 'Бюджетна оценка' },
  { value: 'permit_docs', label: 'Проектна документация за разрешение' },
  { value: 'material_spec', label: 'Спецификация на материали' },
  { value: 'timeline', label: 'Времева рамка / График' },
]

export const DEFAULT_PROCESS_STEPS = [
  { title: 'Първа среща', description: 'Разговаряме за идеята, бюджета и очакванията.', duration: '1 ден' },
  { title: 'Заснемане и анализ', description: 'Работим на място или по съществуващ чертеж.', duration: '2-3 дни' },
  { title: 'Идеен проект', description: 'Получаваш разпределение, скици и/или 3D визуализации.', duration: '7-14 дни' },
  { title: 'Корекции', description: 'Правим уточнения и корекции по избраната посока.', duration: '3-5 дни' },
  { title: 'Финален пакет', description: 'Предаваме PDF, чертежи, спецификации или друг договорен резултат.', duration: '2-3 дни' },
]
