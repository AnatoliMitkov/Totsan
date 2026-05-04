export class MaterialDecisionQuiz extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.state = {
      stepIndex: 0,
      history: [],
      answers: {},
      isComplete: false
    };
    this._config = null;
  }

  set config(val) {
    this._config = val;
    this.state = { stepIndex: 0, history: [], answers: {}, isComplete: false };
    this.render();
  }

  get currentStep() {
    return this._config?.questions[this.state.stepIndex];
  }

  restart() {
    this.swapView(() => {
      this.state = { stepIndex: 0, history: [], answers: {}, isComplete: false };
      this.render();
    });
  }

  back() {
    if (this.state.history.length === 0) return;
    this.swapView(() => {
      this.state.isComplete = false;
      this.state.stepIndex = this.state.history.pop();
      this.render();
    });
  }

  next(value) {
    this.swapView(() => {
      this.state.answers[this.currentStep.id] = value;
      let nextIdx = this.state.stepIndex + 1;
      
      // Fast forward past conditional questions if conditions aren't met
      while (
        nextIdx < this._config.questions.length && 
        this._config.questions[nextIdx].condition && 
        !this._config.questions[nextIdx].condition(this.state.answers)
      ) {
        nextIdx++;
      }

      if (nextIdx >= this._config.questions.length) {
        this.state.isComplete = true;
        const answers = { ...this.state.answers };
        const recommendation = this._config.calculateResult(answers);
        queueMicrotask(() => {
          this.dispatchEvent(new CustomEvent('quiz-complete', {
            detail: { answers, recommendation },
            bubbles: true,
            composed: true
          }));
        });
      } else {
        this.state.history.push(this.state.stepIndex);
        this.state.stepIndex = nextIdx;
      }
      this.render();
    });
  }

  swapView(callback) {
    const panel = this.shadowRoot.querySelector('.panel');
    if (!panel) return callback();

    const animation = panel.animate(
      [
        { opacity: 1, transform: 'translateY(0px) scale(1)' },
        { opacity: 0, transform: 'translateY(18px) scale(0.985)' }
      ],
      { duration: 170, easing: 'ease' }
    );

    animation.finished.catch(() => {}).finally(() => {
      callback();
      const nextPanel = this.shadowRoot.querySelector('.panel');
      if (!nextPanel) return;
      nextPanel.animate(
        [
          { opacity: 0, transform: 'translateY(18px) scale(0.985)' },
          { opacity: 1, transform: 'translateY(0px) scale(1)' }
        ],
        { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    });
  }

  render() {
    if (!this._config) {
      this.shadowRoot.innerHTML = `<div>Зареждане на конфигурация...</div>`;
      return;
    }

    const isResult = this.state.isComplete;
    const progress = isResult
      ? 100
      : ((this.state.stepIndex + 1) / this._config.questions.length) * 100;

    const step = this.currentStep;
    const recommendation = isResult ? this._config.calculateResult(this.state.answers) : null;
    
    const ui = Object.assign({
      stepText: 'Стъпка',
      doneText: 'Приключено',
      queryText: 'Запитване',
      resultEyebrow: 'Резултат',
      resultTitle: 'Най-подходящото решение за вас',
      consultBtn: 'Консултация със специалист',
      restartBtn: 'Завърти отново',
      backBtn: 'Назад',
      footerNote: 'Един лесен избор.'
    }, this._config.ui || {});

    const stepText = isResult
      ? ui.doneText
      : `${ui.stepText} ${this.state.history.length + 1}`;

    let questionHtml = '';
    if (isResult) {
      const tilesHtml = recommendation.tiles.map(tile => `
        <div class="summary-tile" style="${tile.spanAll ? 'grid-column: 1 / -1;' : ''}">
          <span class="summary-label">${tile.label}</span>
          <strong>${tile.value}</strong>
        </div>
      `).join('');

      questionHtml = `
        <div class="result-stack">
          <span class="eyebrow">${ui.resultEyebrow}</span>
          <h2 class="result-title">${ui.resultTitle}</h2>
          <div class="summary-grid">${tilesHtml}</div>
          <ul class="bullet-list">
            ${recommendation.bullets.map(item => `<li>${item}</li>`).join('')}
          </ul>
          <div class="action-row">
            <button class="primary-button" type="button" data-action="consult">${ui.consultBtn}</button>
            <button class="text-button" type="button" data-action="restart">${ui.restartBtn}</button>
          </div>
        </div>
      `;
    } else {
      questionHtml = `
        <div class="question-stack">
          <span class="eyebrow">${this._config.eyebrow || 'Въпросник'}</span>
          <h2 class="question">${step.question}</h2>
          <div class="options" role="list">
            ${step.options.map(option => {
              const isActive = this.state.answers[step.id] === option;
              return `<button class="option-button${isActive ? ' is-active' : ''}" type="button" data-value="${option}">${option}</button>`;
            }).join('')}
          </div>
          <div class="helper">${this._config.helperText || ''}</div>
        </div>
      `;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        * { box-sizing: border-box; }
        button { font: inherit; }
        .shell {
          position: relative; overflow: hidden; border-radius: 1.75rem;
          background: rgba(255, 255, 255, 0.84);
          border: 1px solid rgba(139, 153, 178, 0.22);
          box-shadow: 0 28px 80px rgba(27, 39, 58, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        }
        .shell::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 26%),
                      linear-gradient(180deg, rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0));
        }
        .panel { position: relative; padding: clamp(1.25rem, 3vw, 2rem); }
        .progress-row {
          display: flex; align-items: center; justify-content: space-between; gap: 1rem;
          margin-bottom: 1.25rem; color: #60708c; font-size: 0.84rem;
          letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500;
        }
        .progress-track {
          width: 100%; height: 0.45rem; border-radius: 999px;
          overflow: hidden; background: #e6ebf4; margin-bottom: 1.5rem;
        }
        .progress-bar {
          height: 100%; border-radius: inherit;
          background: linear-gradient(90deg, #2d6bff 0%, #1fb7b5 100%);
          transition: width 240ms ease;
        }
        .eyebrow {
          display: inline-block; margin-bottom: 0.75rem; font-size: 0.78rem;
          letter-spacing: 0.14em; text-transform: uppercase; color: #667892; font-weight: 600;
        }
        .question, .result-title {
          margin: 0; font-size: clamp(1.6rem, 4vw, 2.2rem); line-height: 1.1;
          letter-spacing: -0.02em; color: #132238; font-weight: 700;
        }
        .question-stack, .result-stack { display: grid; gap: 1rem; }
        .options { display: grid; gap: 0.8rem; margin-top: 0.35rem; }
        .option-button {
          width: 100%; padding: 1rem 1.05rem; border: 1px solid #d7deea; border-radius: 1rem;
          background: #f8fbff; color: #162032; text-align: left; cursor: pointer;
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
          font-weight: 500; font-size: 0.95rem;
        }
        .option-button:hover, .option-button:focus-visible {
          outline: none; transform: translateY(-2px); border-color: #8ba8ff;
          background: #ffffff; box-shadow: 0 16px 30px rgba(45, 107, 255, 0.08);
        }
        .option-button.is-active {
          border-color: #2d6bff; background: linear-gradient(180deg, #eef4ff 0%, #ffffff 100%);
          box-shadow: 0 14px 28px rgba(45, 107, 255, 0.12);
        }
        .helper { color: #72839b; font-size: 0.92rem; }
        .summary-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem; margin-top: 0.5rem;
        }
        .summary-tile {
          padding: 1rem; border-radius: 1rem; background: #f6f9fd; border: 1px solid #dde5f0;
        }
        .summary-label {
          display: block; margin-bottom: 0.35rem; color: #6b7d97;
          font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600;
        }
        .summary-tile strong { font-size: 1.05rem; color: #132238; line-height: 1.25; display: block; }
        .bullet-list { margin: 0.5rem 0 0 0; padding-left: 1.1rem; display: grid; gap: 0.7rem; color: #304259; font-size: 0.95rem; }
        .bullet-list li { line-height: 1.45; }
        .action-row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-top: 0.5rem; }
        .primary-button {
          display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;
          padding: 0.9rem 1.4rem; border-radius: 999px; background: #0f172a; color: #ffffff;
          font-weight: 500; border: none; cursor: pointer; transition: background 180ms ease, transform 180ms ease;
        }
        .primary-button:hover, .primary-button:focus-visible { outline: none; background: #1e293b; transform: translateY(-1px); }
        .primary-button:active { transform: translateY(0); }
        .text-button {
          display: inline-flex; align-items: center; justify-content: center; padding: 0.9rem 1.4rem;
          background: transparent; color: #475569; font-weight: 500; border: none; cursor: pointer; transition: color 180ms ease;
        }
        .text-button:hover, .text-button:focus-visible { outline: none; color: #0f172a; }
        .footer-row {
          display: flex; justify-content: space-between; align-items: center;
          margin-top: 1.8rem; padding-top: 1.25rem; border-top: 1px solid rgba(215, 222, 234, 0.6);
        }
        .footer-note { font-size: 0.85rem; color: #8b9bb4; }
        .ghost-button {
          display: inline-flex; align-items: center; justify-content: center; padding: 0.5rem 1rem;
          background: transparent; color: #475569; font-weight: 500; border: 1px solid #d7deea;
          border-radius: 999px; cursor: pointer; transition: all 180ms ease; font-size: 0.9rem;
        }
        .ghost-button:hover:not(:disabled), .ghost-button:focus-visible:not(:disabled) {
          outline: none; background: #f1f5f9; border-color: #cbd5e1; color: #0f172a;
        }
        .ghost-button[disabled] { opacity: 0.4; cursor: not-allowed; }

        @media (max-width: 480px) {
          .action-row { flex-direction: column; align-items: stretch; }
          .summary-grid { grid-template-columns: 1fr; }
          .summary-tile { grid-column: 1 / -1 !important; }
        }
      </style>
      <section class="shell" aria-label="Мулти-квиз">
        <div class="panel">
          <div class="progress-row">
            <span>${stepText}</span>
            <span>${isResult ? ui.doneText : ui.queryText}</span>
          </div>
          <div class="progress-track" aria-hidden="true">
            <div class="progress-bar" style="width: ${progress}%;"></div>
          </div>
          ${questionHtml}
          ${isResult ? '' : `
            <div class="footer-row">
              <button class="ghost-button" type="button" data-action="back" ${this.state.history.length === 0 ? 'disabled' : ''}>${ui.backBtn}</button>
              <div class="footer-note">${ui.footerNote}</div>
            </div>
          `}
        </div>
      </section>
    `;
    this.bindEvents();
  }

  bindEvents() {
    this.shadowRoot.querySelectorAll('[data-value]').forEach(button => {
      button.addEventListener('click', () => this.next(button.dataset.value));
    });
    this.shadowRoot.querySelector('[data-action="back"]')?.addEventListener('click', () => this.back());
    this.shadowRoot.querySelector('[data-action="restart"]')?.addEventListener('click', () => this.restart());
    
    // Bind dynamic consultation handling
    const consultBtn = this.shadowRoot.querySelector('[data-action="consult"]');
    if (consultBtn) {
      consultBtn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('consultation-request', {
          detail: { answers: this.state.answers, recommendation: this._config.calculateResult(this.state.answers) },
          bubbles: true
        }));
        const url = this.getAttribute('consultation-url') || this._config.consultationUrl;
        if (url) window.location.href = url;
      });
    }
  }
}

customElements.define('material-decision-quiz', MaterialDecisionQuiz);