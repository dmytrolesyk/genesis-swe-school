import { quizAchievements, quizDiagrams, quizQuestions } from './quiz-content.js'
import {
  applyAttempt,
  createInitialProgress,
  getRetryQueue,
  summarizeWeakTopics
} from './quiz-engine.js'

// ── Storage ────────────────────────────────────────────────
const STORAGE_KEY = 'interviewPrepArcade.progress'

function loadProgress () {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function saveProgress (progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch { /* ignore */ }
}

function clearProgress () {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

// ── State ──────────────────────────────────────────────────
let progress = loadProgress() || createInitialProgress(quizQuestions)
let activeQuestions = quizQuestions
let isRetryMode = false
let currentToast = null

const root = document.querySelector('[data-quiz-root]')
const hud = document.querySelector('[data-quiz-hud]')

// ── Diagrams SVG ───────────────────────────────────────────
const diagramSVGs = {
  'request-surface': `<svg viewBox="0 0 400 260" class="quiz-diagram-svg" role="img" aria-label="Request surface diagram">
    <rect x="0" y="0" width="400" height="260" rx="8" fill="#1a1a2e"/>
    <rect x="20" y="15" width="100" height="36" rx="6" fill="#e94560"/><text x="70" y="38" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">Browser</text>
    <rect x="150" y="15" width="100" height="36" rx="6" fill="#0f3460"/><text x="200" y="38" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">Public Web</text>
    <rect x="280" y="15" width="100" height="36" rx="6" fill="#0f3460"/><text x="330" y="38" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">Protected API</text>
    <rect x="150" y="80" width="230" height="36" rx="6" fill="#16213e"/><text x="265" y="103" text-anchor="middle" fill="#e94560" font-size="12" font-weight="bold">Subscription Service</text>
    <rect x="40" y="155" width="90" height="36" rx="6" fill="#533483"/><text x="85" y="178" text-anchor="middle" fill="#fff" font-size="11">PostgreSQL</text>
    <rect x="155" y="155" width="90" height="36" rx="6" fill="#533483"/><text x="200" y="178" text-anchor="middle" fill="#fff" font-size="11">GitHub</text>
    <rect x="270" y="155" width="90" height="36" rx="6" fill="#533483"/><text x="315" y="178" text-anchor="middle" fill="#fff" font-size="11">Mailer</text>
    <line x1="120" y1="33" x2="150" y2="33" stroke="#e94560" stroke-width="2" marker-end="url(#arrow)"/>
    <line x1="200" y1="51" x2="200" y2="80" stroke="#e94560" stroke-width="2" marker-end="url(#arrow)"/>
    <line x1="330" y1="51" x2="330" y2="80" stroke="#e94560" stroke-width="2" marker-end="url(#arrow)"/>
    <line x1="200" y1="116" x2="85" y2="155" stroke="#533483" stroke-width="2" marker-end="url(#arrow)"/>
    <line x1="265" y1="116" x2="200" y2="155" stroke="#533483" stroke-width="2" marker-end="url(#arrow)"/>
    <line x1="330" y1="116" x2="315" y2="155" stroke="#533483" stroke-width="2" marker-end="url(#arrow)"/>
    <text x="200" y="220" text-anchor="middle" fill="#888" font-size="10">x-api-key guard scoped to /api/* only</text>
    <text x="200" y="245" text-anchor="middle" fill="#555" font-size="10">Two entry points, one shared core</text>
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#e94560"/></marker></defs>
  </svg>`,

  'subscription-lifecycle': `<svg viewBox="0 0 400 140" class="quiz-diagram-svg" role="img" aria-label="Subscription lifecycle diagram">
    <rect x="0" y="0" width="400" height="140" rx="8" fill="#1a1a2e"/>
    <rect x="15" y="30" width="80" height="32" rx="6" fill="#e94560"/><text x="55" y="50" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">Pending</text>
    <rect x="115" y="30" width="80" height="32" rx="6" fill="#0f3460"/><text x="155" y="50" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">Confirmed</text>
    <rect x="215" y="30" width="80" height="32" rx="6" fill="#16213e"/><text x="255" y="50" text-anchor="middle" fill="#e94560" font-size="11" font-weight="bold">Active</text>
    <rect x="315" y="30" width="70" height="32" rx="6" fill="#533483"/><text x="350" y="50" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Unsub'd</text>
    <line x1="95" y1="46" x2="115" y2="46" stroke="#e94560" stroke-width="2" marker-end="url(#arrow2)"/>
    <line x1="195" y1="46" x2="215" y2="46" stroke="#e94560" stroke-width="2" marker-end="url(#arrow2)"/>
    <line x1="295" y1="46" x2="315" y2="46" stroke="#e94560" stroke-width="2" marker-end="url(#arrow2)"/>
    <text x="105" y="80" text-anchor="middle" fill="#888" font-size="9">email link</text>
    <text x="205" y="80" text-anchor="middle" fill="#888" font-size="9">scan starts</text>
    <text x="305" y="80" text-anchor="middle" fill="#888" font-size="9">unsub link</text>
    <text x="200" y="120" text-anchor="middle" fill="#555" font-size="10">Confirmation is separate from creation</text>
    <defs><marker id="arrow2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#e94560"/></marker></defs>
  </svg>`,

  'release-scanner': `<svg viewBox="0 0 400 200" class="quiz-diagram-svg" role="img" aria-label="Release scanner flow diagram">
    <rect x="0" y="0" width="400" height="200" rx="8" fill="#1a1a2e"/>
    <rect x="20" y="15" width="80" height="30" rx="6" fill="#e94560"/><text x="60" y="35" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Tick</text>
    <rect x="120" y="15" width="80" height="30" rx="6" fill="#0f3460"/><text x="160" y="35" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">List Repos</text>
    <rect x="220" y="15" width="80" height="30" rx="6" fill="#0f3460"/><text x="260" y="35" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Fetch Tag</text>
    <rect x="320" y="15" width="60" height="30" rx="6" fill="#16213e"/><text x="350" y="35" text-anchor="middle" fill="#e94560" font-size="10" font-weight="bold">Compare</text>
    <rect x="120" y="80" width="120" height="30" rx="6" fill="#533483"/><text x="180" y="100" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Baseline (first)</text>
    <rect x="260" y="80" width="120" height="30" rx="6" fill="#533483"/><text x="320" y="100" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Notify (new tag)</text>
    <rect x="170" y="140" width="100" height="30" rx="6" fill="#0f3460"/><text x="220" y="160" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Update DB</text>
    <line x1="100" y1="30" x2="120" y2="30" stroke="#e94560" stroke-width="2" marker-end="url(#arrow3)"/>
    <line x1="200" y1="30" x2="220" y2="30" stroke="#e94560" stroke-width="2" marker-end="url(#arrow3)"/>
    <line x1="300" y1="30" x2="320" y2="30" stroke="#e94560" stroke-width="2" marker-end="url(#arrow3)"/>
    <line x1="335" y1="45" x2="180" y2="80" stroke="#533483" stroke-width="2" marker-end="url(#arrow3)"/>
    <line x1="365" y1="45" x2="320" y2="80" stroke="#533483" stroke-width="2" marker-end="url(#arrow3)"/>
    <line x1="220" y1="110" x2="220" y2="140" stroke="#e94560" stroke-width="2" marker-end="url(#arrow3)"/>
    <text x="200" y="188" text-anchor="middle" fill="#555" font-size="10">First tag = baseline. Later changes = email.</text>
    <defs><marker id="arrow3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#e94560"/></marker></defs>
  </svg>`,

  'cache-fallback': `<svg viewBox="0 0 400 180" class="quiz-diagram-svg" role="img" aria-label="Cache fallback diagram">
    <rect x="0" y="0" width="400" height="180" rx="8" fill="#1a1a2e"/>
    <rect x="20" y="20" width="70" height="32" rx="6" fill="#e94560"/><text x="55" y="40" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">App</text>
    <rect x="140" y="20" width="80" height="32" rx="6" fill="#0f3460"/><text x="180" y="40" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">Redis</text>
    <rect x="280" y="20" width="100" height="32" rx="6" fill="#16213e"/><text x="330" y="40" text-anchor="middle" fill="#e94560" font-size="11" font-weight="bold">GitHub API</text>
    <line x1="90" y1="36" x2="140" y2="36" stroke="#e94560" stroke-width="2" marker-end="url(#arrow4)"/>
    <text x="115" y="28" text-anchor="middle" fill="#888" font-size="9">check</text>
    <text x="180" y="75" text-anchor="middle" fill="#0f0" font-size="10" font-weight="bold">HIT → return cached</text>
    <line x1="220" y1="36" x2="280" y2="36" stroke="#533483" stroke-width="2" stroke-dasharray="4" marker-end="url(#arrow4)"/>
    <text x="250" y="28" text-anchor="middle" fill="#888" font-size="9">MISS</text>
    <rect x="100" y="110" width="200" height="32" rx="6" fill="#533483"/><text x="200" y="130" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">Redis down? → call GitHub directly</text>
    <line x1="55" y1="52" x2="100" y2="110" stroke="#e94560" stroke-width="2" stroke-dasharray="4" marker-end="url(#arrow4)"/>
    <text x="200" y="162" text-anchor="middle" fill="#555" font-size="10">Cache improves speed but is never a hard dependency</text>
    <defs><marker id="arrow4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#e94560"/></marker></defs>
  </svg>`
}

// ── Diagram pit stops schedule ─────────────────────────────
const diagramSchedule = [
  { afterIndex: 5, diagramId: 'request-surface' },
  { afterIndex: 11, diagramId: 'subscription-lifecycle' },
  { afterIndex: 16, diagramId: 'release-scanner' },
  { afterIndex: 21, diagramId: 'cache-fallback' }
]

// ── Achievement triggers ───────────────────────────────────
const achievementTriggers = {
  5: 'rate-limit-survivor',
  15: 'token-tamer',
  25: 'monolith-defender',
  10: 'schema-sage',
  20: 'cache-whisperer',
  30: 'deploy-captain'
}

// ── Helpers ────────────────────────────────────────────────
function h (tag, attrs, ...children) {
  const el = document.createElement(tag)
  if (attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'className') el.className = val
      else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), val)
      else if (key === 'dataset') Object.assign(el.dataset, val)
      else el.setAttribute(key, val)
    }
  }
  for (const child of children.flat()) {
    if (child == null) continue
    el.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return el
}

function categoryLabel (cat) {
  const labels = {
    api: '🔌 API',
    database: '🗄️ Database',
    scanner: '🔍 Scanner',
    deployment: '🚀 Deploy',
    security: '🔒 Security',
    testing: '🧪 Testing',
    architecture: '🏗️ Architecture'
  }
  return labels[cat] || cat
}

function kindLabel (kind) {
  const labels = {
    single: 'Pick one',
    multi: 'Pick all that apply',
    order: 'Tap in order',
    boss: '🔥 Boss Fight'
  }
  return labels[kind] || kind
}

// ── Toast system ───────────────────────────────────────────
function showToast (message) {
  if (currentToast) currentToast.remove()
  const toast = h('div', { className: 'quiz-toast', role: 'status', 'aria-live': 'polite' }, message)
  document.body.appendChild(toast)
  currentToast = toast
  requestAnimationFrame(() => toast.classList.add('quiz-toast--visible'))
  setTimeout(() => {
    toast.classList.remove('quiz-toast--visible')
    setTimeout(() => toast.remove(), 300)
  }, 2500)
}

function checkAchievement (answeredCount) {
  const achievementId = achievementTriggers[answeredCount]
  if (!achievementId) return
  const achievement = quizAchievements.find((a) => a.id === achievementId)
  if (achievement) showToast(`🏆 ${achievement.label}`)
}

// ── HUD ────────────────────────────────────────────────────
function renderHud () {
  if (!hud) return
  const total = activeQuestions.length
  const answered = progress.correctQuestionIds.length
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0

  hud.innerHTML = ''
  hud.appendChild(
    h('div', { className: 'hud-bar' },
      h('span', { className: 'hud-item' }, `⚡ ${progress.score} XP`),
      h('span', { className: 'hud-item' }, `🔥 ${progress.streak}`),
      h('span', { className: 'hud-item' }, `${answered}/${total}`)
    )
  )
  const track = h('div', { className: 'hud-progress-track' },
    h('div', { className: 'hud-progress-fill', style: `width:${pct}%` })
  )
  hud.appendChild(track)
}

// ── Intro ──────────────────────────────────────────────────
function renderIntro () {
  root.innerHTML = ''
  const categories = [...new Set(quizQuestions.map((q) => q.category))]
  const chips = categories.map((c) => h('span', { className: 'quiz-chip' }, categoryLabel(c)))

  const hasSaved = loadProgress() !== null

  root.appendChild(
    h('div', { className: 'quiz-intro' },
      h('p', { className: 'quiz-flavor' }, 'You are slightly cooked but still dangerous.'),
      h('p', null, `${quizQuestions.length} questions across ${categories.length} categories. Grounded in your codebase, the assignment, and the course page.`),
      h('div', { className: 'quiz-chips' }, ...chips),
      h('div', { className: 'quiz-intro-actions' },
        h('button', { className: 'quiz-btn quiz-btn--primary', onClick: startRun }, hasSaved ? 'Resume Run' : 'Start Run'),
        hasSaved ? h('button', { className: 'quiz-btn quiz-btn--secondary', onClick: resetRun }, 'Restart') : null
      )
    )
  )
}

function startRun () {
  isRetryMode = false
  activeQuestions = quizQuestions
  renderHud()
  renderCurrentQuestion()
}

function resetRun () {
  if (!confirm('Reset all progress?')) return
  clearProgress()
  progress = createInitialProgress(quizQuestions)
  isRetryMode = false
  activeQuestions = quizQuestions
  renderHud()
  renderIntro()
}

// ── Question renderer ──────────────────────────────────────
function renderCurrentQuestion () {
  const idx = progress.currentIndex
  if (idx >= activeQuestions.length) {
    renderResults()
    return
  }

  // Check if we need a diagram pit stop
  if (!isRetryMode) {
    const pitStop = diagramSchedule.find((s) => s.afterIndex === idx)
    if (pitStop && !root.dataset.shownDiagram?.includes(pitStop.diagramId)) {
      renderDiagramPitStop(pitStop.diagramId, () => renderCurrentQuestion())
      root.dataset.shownDiagram = (root.dataset.shownDiagram || '') + ',' + pitStop.diagramId
      return
    }
  }

  const question = activeQuestions[idx]
  renderQuestion(question)
}

function renderQuestion (question) {
  root.innerHTML = ''
  const isBoss = question.kind === 'boss'
  const isOrder = question.kind === 'order'
  const isMulti = question.kind === 'multi'

  const selectedIds = []

  const card = h('div', { className: `quiz-card ${isBoss ? 'quiz-card--boss' : ''}` },
    h('div', { className: 'quiz-card-header' },
      h('span', { className: 'quiz-card-category' }, categoryLabel(question.category)),
      h('span', { className: 'quiz-card-kind' }, kindLabel(question.kind))
    ),
    h('h2', { className: 'quiz-card-prompt' }, question.prompt)
  )

  const optionsContainer = h('div', { className: 'quiz-options', role: 'group', 'aria-label': 'Answer options' })

  if (isOrder) {
    // Tap-to-sequence
    const sequence = h('div', { className: 'quiz-sequence' })
    const seqLabel = h('p', { className: 'quiz-sequence-label' }, 'Your order: (tap options below)')

    question.options.forEach((opt) => {
      const btn = h('button', {
        className: 'quiz-option-btn',
        dataset: { optionId: opt.id },
        onClick: () => {
          if (selectedIds.includes(opt.id)) return
          selectedIds.push(opt.id)
          btn.classList.add('quiz-option-btn--selected')
          btn.disabled = true
          sequence.appendChild(h('span', { className: 'quiz-sequence-item' }, `${selectedIds.length}. ${opt.label}`))
          if (selectedIds.length === question.options.length) {
            submitBtn.disabled = false
          }
        }
      }, opt.label)
      optionsContainer.appendChild(btn)
    })

    card.appendChild(seqLabel)
    card.appendChild(sequence)
  } else {
    // Radio or checkbox
    question.options.forEach((opt) => {
      const btn = h('button', {
        className: 'quiz-option-btn',
        role: isMulti ? 'checkbox' : 'radio',
        'aria-checked': 'false',
        dataset: { optionId: opt.id },
        onClick: () => {
          if (isMulti) {
            const idx = selectedIds.indexOf(opt.id)
            if (idx >= 0) {
              selectedIds.splice(idx, 1)
              btn.classList.remove('quiz-option-btn--selected')
              btn.setAttribute('aria-checked', 'false')
            } else {
              selectedIds.push(opt.id)
              btn.classList.add('quiz-option-btn--selected')
              btn.setAttribute('aria-checked', 'true')
            }
          } else {
            // Single / boss — deselect others
            selectedIds.length = 0
            selectedIds.push(opt.id)
            optionsContainer.querySelectorAll('.quiz-option-btn').forEach((b) => {
              b.classList.remove('quiz-option-btn--selected')
              b.setAttribute('aria-checked', 'false')
            })
            btn.classList.add('quiz-option-btn--selected')
            btn.setAttribute('aria-checked', 'true')
          }
          submitBtn.disabled = selectedIds.length === 0
        }
      }, opt.label)
      optionsContainer.appendChild(btn)
    })
  }

  card.appendChild(optionsContainer)

  const submitBtn = h('button', {
    className: 'quiz-btn quiz-btn--primary quiz-btn--submit',
    disabled: true,
    onClick: () => handleSubmit(question, selectedIds)
  }, 'Check Answer')

  card.appendChild(submitBtn)

  // Weak spots button (available after some answers)
  if (progress.missedQuestionIds.length > 0) {
    card.appendChild(
      h('button', {
        className: 'quiz-btn quiz-btn--link',
        onClick: renderWeakSpots
      }, `🎯 Weak spots (${progress.missedQuestionIds.length})`)
    )
  }

  root.appendChild(card)
  renderHud()
}

// ── Submit and feedback ────────────────────────────────────
function handleSubmit (question, selectedIds) {
  const attemptResult = applyAttempt(progress, question, selectedIds)
  progress = attemptResult.progress
  saveProgress(progress)
  renderHud()

  if (attemptResult.result.isCorrect) {
    checkAchievement(progress.correctQuestionIds.length)
  }

  renderFeedback(attemptResult.result, question)
}

function renderFeedback (result, question) {
  root.innerHTML = ''
  const isCorrect = result.isCorrect
  const correctLabels = question.options
    .filter((o) => question.correctOptionIds.includes(o.id))
    .map((o) => o.label)

  const card = h('div', {
    className: `quiz-feedback ${isCorrect ? 'quiz-feedback--correct' : 'quiz-feedback--wrong'}`,
    role: 'status',
    'aria-live': 'polite'
  },
  h('h2', { className: 'quiz-feedback-title' }, isCorrect ? '✅ Correct!' : '❌ Not quite'),
  !isCorrect
    ? h('div', { className: 'quiz-feedback-correct' },
      h('strong', null, 'Correct answer:'),
      h('p', null, correctLabels.join(', '))
    )
    : null,
  h('div', { className: 'quiz-feedback-explain' },
    h('strong', null, 'Why:'),
    h('p', null, question.explanation)
  ),
  h('details', { className: 'quiz-feedback-interview' },
    h('summary', null, '🎤 Interview-ready answer'),
    h('p', null, question.interviewAnswer),
    h('p', { className: 'quiz-feedback-deeper' }, `💡 ${question.deeperFollowUp}`)
  )
  )

  const actions = h('div', { className: 'quiz-feedback-actions' })

  if (result.shouldRetry) {
    actions.appendChild(
      h('button', { className: 'quiz-btn quiz-btn--primary', onClick: () => renderQuestion(question) }, 'Retry This One')
    )
    actions.appendChild(
      h('button', {
        className: 'quiz-btn quiz-btn--secondary',
        onClick: () => advanceQuestion()
      }, 'Skip for Now')
    )
  } else {
    actions.appendChild(
      h('button', { className: 'quiz-btn quiz-btn--primary', onClick: () => advanceQuestion() }, 'Continue →')
    )
  }

  card.appendChild(actions)
  root.appendChild(card)

  // Focus the first action button
  const firstBtn = actions.querySelector('button')
  if (firstBtn) firstBtn.focus()
}

function advanceQuestion () {
  progress.currentIndex += 1
  saveProgress(progress)
  renderCurrentQuestion()
}

// ── Diagram pit stops ──────────────────────────────────────
function renderDiagramPitStop (diagramId, onContinue) {
  const diagram = quizDiagrams.find((d) => d.id === diagramId)
  if (!diagram) { onContinue(); return }

  root.innerHTML = ''
  const card = h('div', { className: 'quiz-diagram-card' },
    h('h2', { className: 'quiz-diagram-title' }, `📊 ${diagram.title}`),
    h('p', { className: 'quiz-diagram-caption' }, diagram.caption)
  )

  const svgWrapper = h('div', { className: 'quiz-diagram-wrapper' })
  svgWrapper.innerHTML = diagramSVGs[diagramId] || '<p>Diagram not available</p>'
  card.appendChild(svgWrapper)

  card.appendChild(
    h('div', { className: 'quiz-diagram-note' },
      h('strong', null, '🎤 Why this matters: '),
      h('span', null, diagram.interviewNote)
    )
  )

  card.appendChild(
    h('button', { className: 'quiz-btn quiz-btn--primary', onClick: onContinue }, 'Continue →')
  )

  root.appendChild(card)
}

// ── Weak spots panel ───────────────────────────────────────
function renderWeakSpots () {
  root.innerHTML = ''
  const summary = summarizeWeakTopics(quizQuestions, progress.missedQuestionIds)

  const panel = h('div', { className: 'quiz-weak-spots' },
    h('h2', null, '🎯 Weak Spots'),
    h('p', null, `${progress.missedQuestionIds.length} missed across ${summary.length} categories`)
  )

  for (const topic of summary) {
    const section = h('div', { className: 'quiz-weak-topic' },
      h('h3', null, `${categoryLabel(topic.category)} — ${topic.misses} miss${topic.misses > 1 ? 'es' : ''}`)
    )
    for (const item of topic.items) {
      section.appendChild(
        h('div', { className: 'quiz-weak-item' },
          h('p', { className: 'quiz-weak-prompt' }, item.prompt),
          h('p', { className: 'quiz-weak-answer' }, `🎤 ${item.interviewAnswer}`)
        )
      )
    }
    panel.appendChild(section)
  }

  const actions = h('div', { className: 'quiz-feedback-actions' })
  actions.appendChild(
    h('button', { className: 'quiz-btn quiz-btn--primary', onClick: startRetryMode }, 'Retry Weak Spots')
  )
  actions.appendChild(
    h('button', { className: 'quiz-btn quiz-btn--secondary', onClick: () => renderCurrentQuestion() }, 'Back to Quiz')
  )
  panel.appendChild(actions)

  root.appendChild(panel)
}

function startRetryMode () {
  isRetryMode = true
  const retryQ = getRetryQueue(quizQuestions, progress.missedQuestionIds)
  if (retryQ.length === 0) {
    showToast('No weak spots! 🎉')
    renderResults()
    return
  }
  activeQuestions = retryQ
  progress.currentIndex = 0
  saveProgress(progress)
  renderHud()
  renderCurrentQuestion()
}

// ── Results and cram sheet ─────────────────────────────────
function renderResults () {
  root.innerHTML = ''
  const total = quizQuestions.length
  const correct = progress.correctQuestionIds.length
  const missed = progress.missedQuestionIds.length
  const summary = summarizeWeakTopics(quizQuestions, progress.missedQuestionIds)

  const resultsCard = h('div', { className: 'quiz-results' },
    h('h2', null, '🏁 Run Complete'),
    h('div', { className: 'quiz-results-stats' },
      h('div', { className: 'quiz-stat' }, h('span', { className: 'quiz-stat-value' }, `${progress.score}`), h('span', { className: 'quiz-stat-label' }, 'XP')),
      h('div', { className: 'quiz-stat' }, h('span', { className: 'quiz-stat-value' }, `${correct}/${total}`), h('span', { className: 'quiz-stat-label' }, 'Correct')),
      h('div', { className: 'quiz-stat' }, h('span', { className: 'quiz-stat-value' }, `${progress.streak}`), h('span', { className: 'quiz-stat-label' }, 'Best Streak'))
    )
  )

  if (missed === 0) {
    resultsCard.appendChild(
      h('p', { className: 'quiz-results-perfect' }, '🏆 Perfect run! You are dangerously prepared.')
    )
  }

  root.appendChild(resultsCard)

  // Cram sheet
  if (summary.length > 0) {
    const cramCard = h('div', { className: 'quiz-cram' },
      h('h2', null, '🌙 Bedtime Cram Sheet'),
      h('p', { className: 'quiz-cram-subtitle' }, 'Your weakest topics. Read these answers aloud.')
    )

    const topWeaks = summary.slice(0, 5)
    for (const topic of topWeaks) {
      const section = h('div', { className: 'quiz-cram-topic' },
        h('h3', null, categoryLabel(topic.category))
      )
      for (const item of topic.items) {
        section.appendChild(
          h('div', { className: 'quiz-cram-item' },
            h('p', { className: 'quiz-cram-q' }, `If they ask: "${item.prompt}"`),
            h('p', { className: 'quiz-cram-a' }, `Say: "${item.interviewAnswer}"`)
          )
        )
      }
      cramCard.appendChild(section)
    }

    root.appendChild(cramCard)
  }

  // Final actions
  const actions = h('div', { className: 'quiz-feedback-actions' })
  if (missed > 0) {
    actions.appendChild(
      h('button', { className: 'quiz-btn quiz-btn--primary', onClick: startRetryMode }, `Retry Weak Spots (${missed})`)
    )
  }
  actions.appendChild(
    h('button', { className: 'quiz-btn quiz-btn--secondary', onClick: resetRun }, 'New Run')
  )
  root.appendChild(actions)
}

// ── Boot ───────────────────────────────────────────────────
if (root) {
  renderIntro()
}
