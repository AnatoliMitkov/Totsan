const ZONE_BATHROOM = 'Баня - под и стени';
const ZONE_SHOWER = 'Душ зона';
const ZONE_KITCHEN = 'Кухня';
const ZONE_CORRIDOR = 'Коридор или антре';
const ZONE_OUTDOOR = 'Тераса или външни стъпала';

const BATHROOM_PROBLEM_ACTIVE = 'Да, има активна влага, теч или мухъл';
const BATHROOM_PROBLEM_OLD_UNKNOWN = 'Не съм сигурен/а, банята е стара или слоевете са неясни';
const BATHROOM_PROBLEM_NONE = 'Не, няма видим проблем';
const BATHROOM_BELOW_YES = 'Да, има помещение под банята или мократа зона';
const BATHROOM_BELOW_NO = 'Не';
const BATHROOM_BELOW_UNKNOWN = 'Не знам';
const SHOWER_NO_TRAY = 'Да, има душ зона без корито';
const BATHROOM_SYSTEM_REPLACE_YES = 'Да, ще се прави нова основа/замазка/сифон';
const BATHROOM_SYSTEM_REPLACE_NO = 'Не, сменят се само плочките';
const BATHROOM_SYSTEM_REPLACE_UNKNOWN = 'Не знам още';
const BATHROOM_WET_YES = 'Да, често се мокри';
const BATHROOM_WET_SOMETIMES = 'Понякога, но не постоянно';
const BATHROOM_WET_LOW = 'Не, основно ще се почиства с влажен парцал';
const BATHROOM_LIMESCALE_YES = 'Да, искам да се виждат по-малко';

const CORRIDOR_BASE_OLD_UNKNOWN = 'Да, има стара или неясна основа';
const CORRIDOR_BASE_MINOR = 'Има малки неравности, но няма видим сериозен проблем';
const CORRIDOR_BASE_OK = 'Не, основата изглежда здрава и равна';
const CORRIDOR_DIRT_OFTEN = 'Да, често';
const CORRIDOR_DIRT_SOMETIMES = 'Понякога';
const CORRIDOR_DIRT_RARELY = 'Рядко';
const CORRIDOR_TRAFFIC_HIGH = 'Много натоварена';
const CORRIDOR_TRAFFIC_NORMAL = 'Нормална ежедневна употреба';
const CORRIDOR_TRAFFIC_LOW = 'По-слабо натоварена';

const KITCHEN_AREA_FLOOR = 'Под';
const KITCHEN_AREA_BACKSPLASH = 'Кухненски гръб';
const KITCHEN_AREA_BOTH = 'И двете';
const KITCHEN_SPLASHES_OFTEN = 'Да, често';
const KITCHEN_SPLASHES_SOMETIMES = 'Понякога';
const KITCHEN_SPLASHES_RARELY = 'Рядко';
const KITCHEN_CLEAN_EASY = 'Да, това е водещо';
const KITCHEN_CLEAN_BALANCED = 'Да, но не за сметка на визията';
const KITCHEN_CLEAN_LOW = 'Не е основният фактор';
const KITCHEN_STAINS_YES = 'Да, притесняват ме';
const KITCHEN_STAINS_SOME = 'Донякъде';
const KITCHEN_STAINS_NO = 'Не е водещ проблем';

const OUTDOOR_WET_OFTEN = 'Да, често от дъжд или сняг';
const OUTDOOR_WET_SOMETIMES = 'Понякога';
const OUTDOOR_WET_RARELY = 'Рядко';
const OUTDOOR_SLOPE_PROBLEM = 'Да, има задържане на вода или неясен наклон';
const OUTDOOR_SLOPE_UNKNOWN = 'Не знам дали наклонът е правилен';
const OUTDOOR_SLOPE_OK = 'Не, водата се оттича добре';
const OUTDOOR_BELOW_YES = 'Да, има помещение под терасата';
const OUTDOOR_BELOW_NO = 'Не';
const OUTDOOR_BELOW_UNKNOWN = 'Не знам';
const OUTDOOR_WINTER_YES = 'Да, ще се ползва и през зимата';
const OUTDOOR_WINTER_NO = 'Не, основно в топъл сезон';
const OUTDOOR_WINTER_UNKNOWN = 'Не знам';
const OUTDOOR_OLD_YES = 'Да, има стара напукана настилка';
const OUTDOOR_OLD_MINOR = 'Има стари плочки, но без видими големи проблеми';
const OUTDOOR_OLD_NO = 'Не, основата е нова или ще се подготви';

const SLIP_RISK_HIGH = 'Да, безопасността е много важна';
const PRIORITY_CLEANING = 'Лесна поддръжка';
const PRIORITY_SAFETY = 'Безопасност';
const PRIORITY_LOOK = 'Визия';
const PRIORITY_BUDGET = 'Бюджет';
const PROPERTY_RENTAL = 'Имот под наем';
const PROPERTY_HIGH_USE = 'Обект с много хора';

const bathroomZones = [ZONE_BATHROOM, ZONE_SHOWER];

const bathroomAskSpecialist = [
  'Каква хидроизолационна система ще се използва?',
  'Как ще се решат ъглите, сифона и наклоните?',
  'Какво лепило и фуга са подходящи за тази зона?',
  'Трябва ли да се проверява влажността на основата?'
];

const corridorAskSpecialist = [
  'Основата здрава, суха и равна ли е?',
  'Нужна ли е саморазливна замазка?',
  'Какъв размер плочка е подходящ за коридора?',
  'Каква фуга ще се поддържа лесно?'
];

const kitchenAskSpecialist = [
  'Подът ли ще се облицова, кухненският гръб или и двете?',
  'Каква фуга се чисти лесно при мазнина и петна?',
  'Подходящ ли е избраният формат за основата?',
  'Какъв финиш няма да личи прекалено при ежедневно почистване?'
];

const outdoorAskSpecialist = [
  'Подходяща ли е основата за външни условия?',
  'Как ще се решат наклонът и отводняването?',
  'Какво лепило и фуга са подходящи за външен монтаж?',
  'Повърхността достатъчно нехлъзгава ли е при дъжд и сняг?'
];

const buildTiles = (profile, surface, focus) => [
  { label: 'Обобщение на случая', value: profile, spanAll: true },
  { label: 'Подходяща повърхност', value: surface },
  { label: 'Основен фокус', value: focus }
];

const buildResult = ({
  recommendationTitle,
  recommendationText,
  whyTitle,
  why,
  watchOut,
  askSpecialist,
  dontDecideAlone,
  nextStep,
  riskLevel = 'Нормален риск',
  tiles,
  bullets = []
}) => ({
  recommendationTitle,
  recommendationText,
  whyTitle,
  why,
  watchOut,
  askSpecialist,
  dontDecideAlone,
  nextStep,
  riskLevel,
  tiles,
  bullets,
  cta: {
    primary: 'Изпрати запитване към специалист',
    secondary: 'Започни отначало'
  }
});

const isBathroomZone = (zone) => bathroomZones.includes(zone);
const isOutdoorZone = (zone) => zone === ZONE_OUTDOOR;

export const tilesConfig = {
  eyebrow: 'Плочки и гранитогрес',
  helperText: 'Избор според зона, мокрене, безопасност и поддръжка.',
  consultationUrl: '/contact',
  ui: {
    consultBtn: 'Изпрати запитване към специалист',
    restartBtn: 'Започни отначало'
  },
  questions: [
    {
      id: 'zone',
      question: 'Къде ще се полагат плочките?',
      options: [ZONE_BATHROOM, ZONE_SHOWER, ZONE_KITCHEN, ZONE_CORRIDOR, ZONE_OUTDOOR]
    },
    {
      id: 'bathroomProblem',
      question: 'Има ли вече активна влага, теч, мухъл или неясни стари слоеве?',
      options: [BATHROOM_PROBLEM_ACTIVE, BATHROOM_PROBLEM_OLD_UNKNOWN, BATHROOM_PROBLEM_NONE],
      condition: (answers) => isBathroomZone(answers.zone)
    },
    {
      id: 'bathroomBelow',
      question: 'Има ли помещение под банята или мократа зона?',
      options: [BATHROOM_BELOW_YES, BATHROOM_BELOW_NO, BATHROOM_BELOW_UNKNOWN],
      condition: (answers) => isBathroomZone(answers.zone)
    },
    {
      id: 'showerTray',
      question: 'Има ли душ зона без корито?',
      options: [SHOWER_NO_TRAY, 'Не, има корито или душ кабина', 'Не се отнася за моя случай'],
      condition: (answers) => isBathroomZone(answers.zone)
    },
    {
      id: 'bathroomSystemReplace',
      question: 'Ще се сменя ли основата, замазката или сифонът?',
      options: [BATHROOM_SYSTEM_REPLACE_YES, BATHROOM_SYSTEM_REPLACE_NO, BATHROOM_SYSTEM_REPLACE_UNKNOWN],
      condition: (answers) => isBathroomZone(answers.zone)
    },
    {
      id: 'bathroomWetFrequency',
      question: 'Ще се мокри ли често зоната?',
      options: [BATHROOM_WET_YES, BATHROOM_WET_SOMETIMES, BATHROOM_WET_LOW],
      condition: (answers) => isBathroomZone(answers.zone)
    },
    {
      id: 'bathroomLimescale',
      question: 'Притесняват ли ви варовикови петна?',
      options: [BATHROOM_LIMESCALE_YES, 'Не е водещ проблем', 'Не знам'],
      condition: (answers) =>
        isBathroomZone(answers.zone) &&
        [BATHROOM_WET_YES, BATHROOM_WET_SOMETIMES].includes(answers.bathroomWetFrequency)
    },
    {
      id: 'corridorBase',
      question: 'Има ли стара настилка, пукнатини, неравности или отлепени плочки?',
      options: [CORRIDOR_BASE_OLD_UNKNOWN, CORRIDOR_BASE_MINOR, CORRIDOR_BASE_OK],
      condition: (answers) => answers.zone === ZONE_CORRIDOR
    },
    {
      id: 'corridorOutdoorDirt',
      question: 'Ще се влиза ли директно отвън с мокри обувки, кал или сняг?',
      options: [CORRIDOR_DIRT_OFTEN, CORRIDOR_DIRT_SOMETIMES, CORRIDOR_DIRT_RARELY],
      condition: (answers) => answers.zone === ZONE_CORRIDOR
    },
    {
      id: 'corridorTraffic',
      question: 'Колко натоварена ще е зоната?',
      options: [CORRIDOR_TRAFFIC_HIGH, CORRIDOR_TRAFFIC_NORMAL, CORRIDOR_TRAFFIC_LOW],
      condition: (answers) => answers.zone === ZONE_CORRIDOR
    },
    {
      id: 'kitchenArea',
      question: 'Плочките ще са за под, гръб или и двете?',
      options: [KITCHEN_AREA_FLOOR, KITCHEN_AREA_BACKSPLASH, KITCHEN_AREA_BOTH],
      condition: (answers) => answers.zone === ZONE_KITCHEN
    },
    {
      id: 'kitchenSplashes',
      question: 'Ще има ли често пръски, мазнина или мокрене около мивка?',
      options: [KITCHEN_SPLASHES_OFTEN, KITCHEN_SPLASHES_SOMETIMES, KITCHEN_SPLASHES_RARELY],
      condition: (answers) => answers.zone === ZONE_KITCHEN
    },
    {
      id: 'kitchenEasyClean',
      question: 'Искате ли повърхност, която се чисти лесно?',
      options: [KITCHEN_CLEAN_EASY, KITCHEN_CLEAN_BALANCED, KITCHEN_CLEAN_LOW],
      condition: (answers) => answers.zone === ZONE_KITCHEN
    },
    {
      id: 'kitchenStains',
      question: 'Притесняват ли ви петна, фуги или варовик?',
      options: [KITCHEN_STAINS_YES, KITCHEN_STAINS_SOME, KITCHEN_STAINS_NO],
      condition: (answers) => answers.zone === ZONE_KITCHEN
    },
    {
      id: 'outdoorWetting',
      question: 'Ще се мокри ли зоната от дъжд или сняг?',
      options: [OUTDOOR_WET_OFTEN, OUTDOOR_WET_SOMETIMES, OUTDOOR_WET_RARELY],
      condition: (answers) => isOutdoorZone(answers.zone)
    },
    {
      id: 'outdoorSlope',
      question: 'Има ли задържане на вода или неясен наклон?',
      options: [OUTDOOR_SLOPE_PROBLEM, OUTDOOR_SLOPE_UNKNOWN, OUTDOOR_SLOPE_OK],
      condition: (answers) => isOutdoorZone(answers.zone)
    },
    {
      id: 'outdoorBelow',
      question: 'Има ли помещение под терасата?',
      options: [OUTDOOR_BELOW_YES, OUTDOOR_BELOW_NO, OUTDOOR_BELOW_UNKNOWN],
      condition: (answers) => isOutdoorZone(answers.zone)
    },
    {
      id: 'outdoorWinter',
      question: 'Ще се ползва ли през зимата?',
      options: [OUTDOOR_WINTER_YES, OUTDOOR_WINTER_NO, OUTDOOR_WINTER_UNKNOWN],
      condition: (answers) => isOutdoorZone(answers.zone)
    },
    {
      id: 'outdoorOldSurface',
      question: 'Има ли стара напукана настилка?',
      options: [OUTDOOR_OLD_YES, OUTDOOR_OLD_MINOR, OUTDOOR_OLD_NO],
      condition: (answers) => isOutdoorZone(answers.zone)
    },
    {
      id: 'slipRisk',
      question: 'Има ли деца, възрастни хора или риск от подхлъзване?',
      options: [SLIP_RISK_HIGH, 'Има умерен риск', 'Не, рискът е нисък'],
      condition: (answers) => isBathroomZone(answers.zone) || answers.zone === ZONE_CORRIDOR
    },
    {
      id: 'slipRisk',
      question: 'Има ли риск от подхлъзване на пода, например около мивката?',
      options: [SLIP_RISK_HIGH, 'Има умерен риск', 'Не, рискът е нисък'],
      condition: (answers) =>
        answers.zone === ZONE_KITCHEN &&
        [KITCHEN_AREA_FLOOR, KITCHEN_AREA_BOTH].includes(answers.kitchenArea)
    },
    {
      id: 'slipRisk',
      question: 'Важна ли е нехлъзгава повърхност при дъжд или сняг?',
      options: [SLIP_RISK_HIGH, 'Има умерен риск', 'Не, рискът е нисък'],
      condition: (answers) => isOutdoorZone(answers.zone)
    },
    {
      id: 'priority',
      question: 'Какво е по-важно за вас?',
      options: [PRIORITY_CLEANING, PRIORITY_SAFETY, PRIORITY_LOOK, PRIORITY_BUDGET]
    },
    {
      id: 'propertyUse',
      question: 'Как ще се използва имотът?',
      options: ['Основно жилище', PROPERTY_RENTAL, PROPERTY_HIGH_USE]
    }
  ],
  calculateResult: (answers) => {
    const bathroom = isBathroomZone(answers.zone);
    const corridor = answers.zone === ZONE_CORRIDOR;
    const kitchen = answers.zone === ZONE_KITCHEN;
    const outdoor = isOutdoorZone(answers.zone);

    const isShowerNoTray = answers.showerTray === SHOWER_NO_TRAY;
    const hasSlipRisk = answers.slipRisk === SLIP_RISK_HIGH || answers.priority === PRIORITY_SAFETY;
    const wantsPremiumLook = answers.priority === PRIORITY_LOOK;
    const wantsEasyCare = answers.priority === PRIORITY_CLEANING;
    const wantsBudget = answers.priority === PRIORITY_BUDGET;
    const isRental = answers.propertyUse === PROPERTY_RENTAL;
    const highUse = answers.propertyUse === PROPERTY_HIGH_USE;

    const bathroomActiveMoisture = answers.bathroomProblem === BATHROOM_PROBLEM_ACTIVE;
    const bathroomOldUnknown = answers.bathroomProblem === BATHROOM_PROBLEM_OLD_UNKNOWN;
    const bathroomBelowKnown = answers.bathroomBelow === BATHROOM_BELOW_YES;
    const bathroomBelowUnknown = answers.bathroomBelow === BATHROOM_BELOW_UNKNOWN;
    const bathroomSystemUnknown = answers.bathroomSystemReplace === BATHROOM_SYSTEM_REPLACE_UNKNOWN;
    const bathroomSystemWillNotChange = answers.bathroomSystemReplace === BATHROOM_SYSTEM_REPLACE_NO;
    const bathroomWet = answers.bathroomWetFrequency === BATHROOM_WET_YES;
    const bathroomSometimesWet = answers.bathroomWetFrequency === BATHROOM_WET_SOMETIMES;
    const bathroomLimescale = answers.bathroomLimescale === BATHROOM_LIMESCALE_YES;

    const corridorOldBase = answers.corridorBase === CORRIDOR_BASE_OLD_UNKNOWN;
    const corridorMinorBase = answers.corridorBase === CORRIDOR_BASE_MINOR;
    const corridorWetEntry = answers.corridorOutdoorDirt === CORRIDOR_DIRT_OFTEN;
    const corridorSometimesWet = answers.corridorOutdoorDirt === CORRIDOR_DIRT_SOMETIMES;
    const corridorHighTraffic = answers.corridorTraffic === CORRIDOR_TRAFFIC_HIGH;

    const kitchenFloor = [KITCHEN_AREA_FLOOR, KITCHEN_AREA_BOTH].includes(answers.kitchenArea);
    const kitchenSplashRisk = answers.kitchenSplashes === KITCHEN_SPLASHES_OFTEN;
    const kitchenSomeSplashes = answers.kitchenSplashes === KITCHEN_SPLASHES_SOMETIMES;
    const kitchenEasyCare = [KITCHEN_CLEAN_EASY, KITCHEN_CLEAN_BALANCED].includes(answers.kitchenEasyClean);
    const kitchenStainConcern = [KITCHEN_STAINS_YES, KITCHEN_STAINS_SOME].includes(answers.kitchenStains);

    const outdoorWet = answers.outdoorWetting === OUTDOOR_WET_OFTEN;
    const outdoorSometimesWet = answers.outdoorWetting === OUTDOOR_WET_SOMETIMES;
    const outdoorSlopeRisk = [OUTDOOR_SLOPE_PROBLEM, OUTDOOR_SLOPE_UNKNOWN].includes(answers.outdoorSlope);
    const outdoorBelowKnown = answers.outdoorBelow === OUTDOOR_BELOW_YES;
    const outdoorBelowUnknown = answers.outdoorBelow === OUTDOOR_BELOW_UNKNOWN;
    const outdoorWinterUse = answers.outdoorWinter === OUTDOOR_WINTER_YES;
    const outdoorWinterUnknown = answers.outdoorWinter === OUTDOOR_WINTER_UNKNOWN;
    const outdoorOldSurface = answers.outdoorOldSurface === OUTDOOR_OLD_YES;
    const outdoorMinorOldSurface = answers.outdoorOldSurface === OUTDOOR_OLD_MINOR;

    const anyWet =
      bathroomWet ||
      corridorWetEntry ||
      kitchenSplashRisk ||
      outdoorWet;
    const sometimesWet =
      bathroomSometimesWet ||
      corridorSometimesWet ||
      kitchenSomeSplashes ||
      outdoorSometimesWet;
    const anyStainConcern = bathroomLimescale || kitchenStainConcern;

    const bathroomBaseRisk =
      bathroomActiveMoisture ||
      bathroomOldUnknown ||
      bathroomBelowKnown ||
      bathroomBelowUnknown ||
      bathroomSystemUnknown ||
      bathroomSystemWillNotChange;

    if (bathroom && bathroomBaseRisk) {
      const dontDecideAlone = [];
      if (bathroomActiveMoisture) dontDecideAlone.push('Има активен теч, мокри петна или мухъл.');
      if (bathroomOldUnknown) dontDecideAlone.push('Не знаете какви стари слоеве има под сегашните плочки.');
      if (bathroomBelowKnown) dontDecideAlone.push('Под банята има помещение, което може да пострада при грешна система.');
      if (bathroomBelowUnknown) dontDecideAlone.push('Не е ясно какво има под банята и трябва да се провери рискът.');
      if (bathroomSystemUnknown || bathroomSystemWillNotChange) dontDecideAlone.push('Не е уточнено дали основата, замазката и сифонът са подходящи.');

      return buildResult({
        recommendationTitle: 'Баня с риск от влага или теч',
        recommendationText: 'Плочката е последният видим слой. При теч, мухъл или неясна основа първо се проверяват основата, хидроизолацията, наклоните и отводняването. Изборът на плочка е втори въпрос.',
        whyTitle: 'Защо първо трябва проверка',
        why: [
          'Новите плочки няма да решат теч, мухъл или лош наклон.',
          'При стара или неясна баня първо трябва да е ясно какво има под сегашните плочки.',
          'Сифонът, ъглите и наклоните трябва да работят като система, не само като красива облицовка.'
        ],
        watchOut: 'Не купувайте плочки само по визия, преди да е ясно дали основата е суха, здрава и правилно подготвена.',
        askSpecialist: bathroomAskSpecialist,
        dontDecideAlone,
        nextStep: 'Поканете майстор или специалист да провери основата, сифона, наклоните и зоните около стените преди избор на размер и финиш.',
        riskLevel: 'Висок риск',
        tiles: buildTiles('Диагностика преди избор на плочки', 'След проверка: безопасна повърхност за мокра зона', 'Основа, хидроизолация и отводняване')
      });
    }

    if (bathroom && isShowerNoTray) {
      return buildResult({
        recommendationTitle: 'Душ зона без корито',
        recommendationText: 'Фокусът е върху правилен наклон, добър сифон, пълна хидроизолация и безопасна повърхност под краката.',
        why: [
          'Водата попада директно върху пода и трябва да се отвежда сигурно.',
          'Повърхността трябва да е удобна за стъпване, но и възможна за почистване.',
          'Ъглите, фугите и зоната около сифона са толкова важни, колкото самата плочка.'
        ],
        watchOut: 'Не избирайте полиран под само заради луксозен вид. При намокряне може да стане опасен.',
        askSpecialist: bathroomAskSpecialist,
        dontDecideAlone: ['Не решавайте сами, ако наклонът, сифонът или старите слоеве още не са уточнени.'],
        nextStep: 'Обсъдете първо наклона и хидроизолацията, после изберете формат и финиш на плочката.',
        riskLevel: 'Повишен риск',
        tiles: buildTiles('Мокра душ зона', 'Матова или леко релефна подова плочка', 'Наклон, сифон и безопасност')
      });
    }

    if (corridor && corridorOldBase) {
      return buildResult({
        recommendationTitle: 'Коридор с нужда от проверка на основата',
        recommendationText: 'Преди избор на плочка проверете дали старата основа е здрава, суха и равна.',
        whyTitle: 'Защо първо трябва проверка',
        why: [
          'Коридорът поема мокри обувки, песъчинки и често движение.',
          'Стара или неравна основа може да доведе до кухи участъци, пукнати фуги и лошо лягане на плочките.'
        ],
        watchOut: 'Не избирайте голям формат, преди да знаете дали основата позволява равен монтаж.',
        askSpecialist: corridorAskSpecialist,
        dontDecideAlone: ['Старата или неясна основа трябва да се провери преди избор на формат и финиш.'],
        nextStep: 'Проверете равността и здравината на основата, после изберете формат, фуга и финиш.',
        riskLevel: 'Повишен риск',
        tiles: buildTiles('Коридор със стара или неясна основа', 'Практичен мат или фин сатен след проверка', 'Здрава и равна основа')
      });
    }

    if (corridor) {
      return buildResult({
        recommendationTitle: 'Коридор с фокус върху здрава и лесна за поддръжка настилка',
        recommendationText: 'Матиран или леко структуриран гранитогрес, който изглежда добре, но не става хлъзгав при мокри обувки.',
        why: [
          corridorHighTraffic
            ? 'Зоната ще е много натоварена и има нужда от устойчив финиш.'
            : 'Коридорът събира прах, пясък и вода от обувки.',
          'Гранитогресът е практичен за натоварване, стига финишът да не е прекалено полиран.',
          corridorMinorBase
            ? 'Малките неравности трябва да се проверят, за да не личат след полагане.'
            : wantsEasyCare
              ? 'По-гладък мат се чисти по-лесно от силен релеф.'
              : 'Леката структура помага за сигурност, без да усложнява поддръжката.'
        ],
        watchOut: 'Не избирайте прекалено полиран или силно релефен финиш само по снимка. Полираната повърхност може да се хлъзга, а силно релефната задържа прах и мръсотия.',
        askSpecialist: corridorAskSpecialist,
        dontDecideAlone: corridorMinorBase ? ['Има малки неравности. Попитайте дали основата има нужда от изравняване.'] : '',
        nextStep: 'Сравнете мостри при входната светлина и попитайте дали форматът пасва на ширината на коридора.',
        riskLevel: corridorWetEntry || corridorHighTraffic || hasSlipRisk || corridorMinorBase ? 'Повишен риск' : 'Нормален риск',
        tiles: buildTiles('Практичен коридор / антре', 'Матиран или леко структуриран гранитогрес', 'Издръжливост и лесно почистване')
      });
    }

    if (kitchen) {
      return buildResult({
        recommendationTitle: 'Кухня с фокус върху лесно почистване и устойчивост',
        recommendationText: 'Търсете матова или сатенирана повърхност, която понася петна, мазнина и мокрене около мивката без трудна ежедневна поддръжка.',
        why: [
          kitchenSplashRisk
            ? 'В тази кухня ще има чести пръски, мазнина или мокрене около мивката.'
            : 'В кухнята проблемите обикновено са мазнина, петна, паднали съдове и вода около мивката.',
          kitchenFloor
            ? 'За под е важна устойчивостта, а за гръб - лесното забърсване и фугата.'
            : 'За кухненски гръб водещи са лесното забърсване и подходящата фуга.',
          kitchenStainConcern
            ? 'При вода, мазнина и петна избягвайте повърхности, върху които всяка следа личи веднага.'
            : kitchenEasyCare
              ? 'Сатенът и спокойният мат често са добър баланс между визия и чистене.'
              : 'Може да дадете повече тежест на визията, но проверете мостра на реална светлина.'
        ],
        watchOut: 'Не избирайте силно релефна плочка за зона с мазнина, ако няма да ви е удобно да я чистите често.',
        askSpecialist: kitchenAskSpecialist,
        dontDecideAlone: kitchenSplashRisk && kitchenFloor
          ? ['При под около мивка уточнете финиш, фуга и устойчивост на ежедневно мокрене.']
          : '',
        nextStep: 'Уточнете дали говорите за под, кухненски гръб или и двете, защото подходящият финиш може да е различен.',
        riskLevel: kitchenSplashRisk || kitchenStainConcern || hasSlipRisk ? 'Повишен риск' : 'Нормален риск',
        tiles: buildTiles('Практична кухня', 'Мат или сатен с лесна за чистене фуга', 'Петна, мазнина и устойчивост')
      });
    }

    if (outdoor) {
      const outdoorBelowConcern = outdoorBelowKnown || outdoorBelowUnknown;
      const outdoorSystemRisk =
        outdoorWet ||
        outdoorSlopeRisk ||
        outdoorBelowConcern ||
        outdoorWinterUse ||
        outdoorWinterUnknown ||
        outdoorOldSurface;

      const dontDecideAlone = [];
      if (outdoorSlopeRisk) dontDecideAlone.push('Има задържане на вода или неясен наклон.');
      if (outdoorBelowKnown) dontDecideAlone.push('Под терасата има помещение и отводняването трябва да се провери.');
      if (outdoorBelowUnknown) dontDecideAlone.push('Не е ясно какво има под терасата.');
      if (outdoorOldSurface) dontDecideAlone.push('Има стара напукана настилка, която може да скрие проблеми в основата.');
      if (outdoorWinterUse || outdoorWinterUnknown) dontDecideAlone.push('Зоната трябва да се мисли за замръзване и външни температурни промени.');

      return buildResult({
        recommendationTitle: 'Външна зона с фокус върху безопасност и отводняване',
        recommendationText: 'Изберете външен гранитогрес и монтажна система за мокрене, замръзване, наклон и нехлъзгава повърхност.',
        why: [
          'Навън плочките работят при дъжд, студ, слънце и температурни промени.',
          'Наклонът и отводняването са критични, за да не стои вода върху настилката.',
          outdoorMinorOldSurface
            ? 'Старата настилка трябва да се провери, дори когато няма големи видими проблеми.'
            : 'Повърхността трябва да е сигурна при мокрене, без да задържа прекалено мръсотия.'
        ],
        watchOut: 'Не използвайте indoor-only решения за тераса или външни стъпала. Попитайте за външно лепило, фуга и правилен наклон.',
        askSpecialist: outdoorAskSpecialist,
        dontDecideAlone,
        nextStep: 'Първо уточнете наклона, основата и външната монтажна система, после изберете финиш и формат.',
        riskLevel: outdoorSystemRisk || hasSlipRisk || outdoorMinorOldSurface ? 'Повишен риск' : 'Нормален риск',
        tiles: buildTiles('Тераса или външни стъпала', 'Нехлъзгав външен гранитогрес', 'Мокрене, замръзване и отводняване')
      });
    }

    if (isRental || highUse || wantsBudget || wantsPremiumLook || anyWet || sometimesWet || hasSlipRisk) {
      return buildResult({
        recommendationTitle: 'Балансиран избор за вашата зона',
        recommendationText: 'Търсете спокойна визия, практична повърхност и потвърждение, че основата е подходяща за избрания формат.',
        why: [
          'Най-добрият избор зависи от зоната, мокренето и начина на ползване.',
          'Мат или сатен обикновено са по-прощаващи за ежедневна употреба.',
          'Правилното лепило, фуга и подготовка влияят повече на дългия живот от самия цвят.'
        ],
        watchOut: anyStainConcern
          ? 'Ако водата оставя петна, избягвайте много тъмни и силно гланцови повърхности.'
          : 'Не избирайте само по снимка. Вижте мостра на реална светлина и я докоснете.',
        askSpecialist: [
          'Основата здрава, суха и равна ли е?',
          'Какъв формат е подходящ за конкретната зона?',
          'Каква фуга ще се поддържа най-лесно?'
        ],
        nextStep: 'Сравнете 2-3 мостри в помещението и обсъдете с майстор дали форматът пасва на основата.',
        tiles: buildTiles('Балансиран избор', 'Мат или сатен според зоната', 'Визия и поддръжка')
      });
    }

    return buildResult({
      recommendationTitle: 'Балансиран избор за вашата зона',
      recommendationText: 'Изберете практична плочка според зоната, мокренето и поддръжката, без да разчитате само на снимка или цвят.',
      why: [
        'Зоната няма силни рискове, затова може да балансирате визия, бюджет и поддръжка.',
        'Практичният финиш ще ви спести повече неудобства от ефектна, но трудна за поддръжка повърхност.'
      ],
      watchOut: 'Проверете мостра на реална светлина и попитайте дали избраният размер пасва на основата.',
      askSpecialist: [
        'Основата готова ли е за този формат?',
        'Каква фуга е практична за ежедневна поддръжка?',
        'Има ли особености при полагането в тази зона?'
      ],
      nextStep: 'Изберете 2-3 мостри и ги сравнете там, където реално ще се полагат.',
      tiles: buildTiles('Обща зона с нисък риск', 'Практичен мат или сатен', 'Поддръжка и правилен монтаж')
    });
  }
};
