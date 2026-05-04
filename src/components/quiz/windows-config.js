export const windowsConfig = {
  eyebrow: 'Избор на дограма',
  helperText: 'Кратък въпросник за правилен избор.',
  consultationUrl: '/contact',
  questions: [
    { 
      id: 'usage', 
      question: 'Какъв тип обект ще изолираме?', 
      options: ['Къща', 'Апартамент', 'Офис'] 
    },
    { 
      id: 'priority', 
      question: 'Кое е най-важно за вас?', 
      options: ['Енергийна ефективност', 'Шумоизолация', 'Бюджет', 'Премиум качество'] 
    },
    { 
      id: 'noise', 
      question: 'Обектът намира ли се до натоварена улица / шумна зона?', 
      options: ['Да, много е шумно', 'Умерен шум', 'Не, тихо е'],
      condition: (answers) => answers.priority === 'Шумоизолация' || answers.usage === 'Апартамент'
    },
    { 
      id: 'sun', 
      question: 'Какво е слънцегреенето?', 
      options: ['Силно (юг/запад)', 'Умерено', 'Сянка (север)'] 
    },
    { 
      id: 'material', 
      question: 'Имате ли предпочитания към материала?', 
      options: ['PVC', 'Алуминий', 'Нямам предпочитания'] 
    },
    { 
      id: 'budget', 
      question: 'Какъв е предвиденият budget?', 
      options: ['Нисък', 'Среден', 'Висок'] 
    }
  ],
  calculateResult: (answers) => {
    const usage = answers.usage;
    const priority = answers.priority;
    const sun = answers.sun;
    const material = answers.material;
    const budget = answers.budget;
    const noise = answers.noise || 'Не, тихо е';

    const wantsEnergy = priority === 'Енергийна ефективност';
    const wantsQuiet = priority === 'Шумоизолация' || noise === 'Да, много е шумно';
    const wantsPremium = priority === 'Премиум качество';
    const costSensitive = priority === 'Бюджет' || budget === 'Нисък';
    const strongSun = sun === 'Силно (юг/запад)';

    let windowType = 'PVC профили';
    let glazing = 'Двоен стъклопакет';

    if (material === 'PVC') {
      windowType = strongSun && budget === 'Висок' ? 'Хибрид (PVC + Алуминиева капачка)' : 'PVC профили';
    } else if (material === 'Алуминий') {
      windowType = costSensitive && !wantsPremium ? 'Хибрид (PVC + Алуминиева капачка)' : 'Алуминиева дограма (прекъснат термомост)';
    } else {
      if (costSensitive) {
        windowType = 'PVC профили';
      } else if (wantsPremium || strongSun || usage === 'Офис') {
        windowType = 'Алуминиева дограма (прекъснат термомост)';
      } else if (wantsEnergy || wantsQuiet || usage === 'Къща') {
        windowType = 'Хибрид (PVC + Алуминиева капачка)';
      } else {
        windowType = 'PVC профили';
      }
    }

    if (costSensitive && priority === 'Бюджет') {
      glazing = 'Двоен стъклопакет';
    } else if (wantsEnergy || wantsQuiet || usage === 'Къща' || (strongSun && budget === 'Висок')) {
      glazing = 'Троен стъклопакет';
    }

    if (windowType === 'Алуминиева дограма (прекъснат термомост)' && costSensitive && material !== 'Алуминий') {
      windowType = 'Хибрид (PVC + Алуминиева капачка)';
    }

    const focusMap = {
      'Енергийна ефективност': 'минимизиране на топлинните загуби',
      'Шумоизолация': 'по-тихи помещения и акустичен комфорт',
      'Бюджет': 'надеждно решение на по-достъпна цена',
      'Премиум качество': 'висока издръжливост и луксозно усещане'
    };

    const priorityReason = focusMap[priority] || 'балансирано решение';

    const bullets = [
      `Този профил е изключително подходящ за ${usage.toLowerCase()}, съобразен с изискванията ви.`,
      `${glazing} е необходим, за да постигнем целите ви за ${priorityReason}.`
    ];

    if (strongSun) {
      bullets.push('При силно слънцегреене капачката или изцяло алуминиевият профил гарантират, че няма да има увисване или деформации във времето.');
    } else if (costSensitive) {
      bullets.push('Спецификацията е максимално изчистена, за да не натоварва излишно бюджета ви.');
    } else {
      bullets.push('Конфигурацията е балансирана за максимален комфорт при дългосрочна експлоатация.');
    }

    return {
      tiles: [
        { label: 'Препоръчителен профил', value: windowType, spanAll: true },
        { label: 'Подходящ стъклопакет', value: glazing }
      ],
      bullets: bullets.slice(0, 3)
    };
  }
};