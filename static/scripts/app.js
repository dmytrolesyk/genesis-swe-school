/* global FormData, Intl, Node, document, fetch, localStorage, setInterval */

const storageKeys = {
  email: 'releaseNotifier.email',
  preferences: 'releaseNotifier.preferences'
}

const defaultPreferences = {
  backgroundDim: 'normal',
  clockFormat: '24',
  density: 'cozy',
  motion: 'normal'
}

const elements = {
  accountEmail: document.querySelector('#account-email'),
  accountSummary: document.querySelector('[data-account-summary]'),
  clearEmail: document.querySelector('[data-clear-email]'),
  clearLocalData: document.querySelector('[data-clear-local-data]'),
  clock: document.querySelector('[data-clock]'),
  loadSubscriptions: document.querySelector('[data-load-subscriptions]'),
  menu: document.querySelector('#xp-start-menu'),
  menuEmail: document.querySelector('#menu-email'),
  panels: document.querySelectorAll('[data-panel]'),
  preferenceControls: document.querySelectorAll('[data-preference]'),
  saveAccount: document.querySelector('[data-save-account]'),
  saveEmail: document.querySelector('[data-save-email]'),
  startButton: document.querySelector('[data-start-button]'),
  startEmail: document.querySelector('[data-start-email]'),
  subscriptionList: document.querySelector('[data-subscription-list]'),
  subscriptionSummary: document.querySelector('[data-subscription-summary]'),
  subscribeForm: document.querySelector('[data-subscribe-form]'),
  triggers: document.querySelectorAll('[data-panel-trigger]')
}

function readSavedEmail () {
  return localStorage.getItem(storageKeys.email) ?? ''
}

function writeSavedEmail (email) {
  const trimmedEmail = email.trim()

  if (trimmedEmail === '') {
    localStorage.removeItem(storageKeys.email)
  } else {
    localStorage.setItem(storageKeys.email, trimmedEmail)
  }

  syncEmailFields()
}

function readPreferences () {
  try {
    const raw = localStorage.getItem(storageKeys.preferences)
    const parsed = raw === null ? {} : JSON.parse(raw)

    return {
      ...defaultPreferences,
      ...parsed
    }
  } catch {
    return { ...defaultPreferences }
  }
}

function writePreferences (preferences) {
  localStorage.setItem(storageKeys.preferences, JSON.stringify(preferences))
  applyPreferences(preferences)
}

function applyPreferences (preferences) {
  document.body.dataset.backgroundDim = preferences.backgroundDim
  document.body.dataset.clockFormat = preferences.clockFormat
  document.body.dataset.density = preferences.density
  document.body.dataset.motion = preferences.motion

  elements.preferenceControls.forEach((control) => {
    const key = control.dataset.preference

    if (key === 'clockFormat' || key === 'backgroundDim' || key === 'motion' || key === 'density') {
      control.value = preferences[key]
    }
  })
}

function isEmailLike (email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function syncEmailFields () {
  const email = readSavedEmail()
  const label = email === '' ? 'No email saved' : email

  if (elements.startEmail !== null) {
    elements.startEmail.textContent = label
  }

  if (elements.accountSummary !== null) {
    elements.accountSummary.textContent = email === ''
      ? 'No saved email yet.'
      : `Saved email: ${email}`
  }

  if (elements.subscriptionSummary !== null) {
    elements.subscriptionSummary.textContent = email === ''
      ? 'Save an email, then load subscriptions.'
      : `Ready to load subscriptions for ${email}.`
  }

  if (elements.loadSubscriptions !== null) {
    elements.loadSubscriptions.textContent = 'Load subscriptions'
  }

  if (elements.menuEmail !== null) {
    elements.menuEmail.value = email
  }

  if (elements.accountEmail !== null) {
    elements.accountEmail.value = email
  }
}

function setMenuOpen (isOpen) {
  if (elements.menu === null || elements.startButton === null) {
    return
  }

  elements.menu.hidden = !isOpen
  elements.startButton.setAttribute('aria-expanded', String(isOpen))
}

function showPanel (panelName) {
  elements.panels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== panelName
  })

  elements.triggers.forEach((trigger) => {
    trigger.setAttribute(
      'aria-current',
      trigger.dataset.panelTrigger === panelName ? 'true' : 'false'
    )
  })
}

function clearSubscriptionList () {
  if (elements.subscriptionList !== null) {
    elements.subscriptionList.replaceChildren()
  }
}

function setSubscriptionMessage (message) {
  clearSubscriptionList()

  if (elements.subscriptionList === null) {
    return
  }

  const paragraph = document.createElement('p')
  paragraph.textContent = message
  elements.subscriptionList.append(paragraph)
}

function renderSubscriptions (subscriptions) {
  clearSubscriptionList()

  if (elements.subscriptionList === null) {
    return
  }

  if (subscriptions.length === 0) {
    setSubscriptionMessage('No active subscriptions for this email yet.')
    return
  }

  const fragment = document.createDocumentFragment()

  subscriptions.forEach((subscription) => {
    const item = document.createElement('article')
    item.className = 'subscription-item'

    const repo = document.createElement('strong')
    repo.textContent = subscription.repo

    const meta = document.createElement('p')
    meta.className = 'subscription-meta'
    meta.textContent = `${subscription.confirmed ? 'Confirmed' : 'Pending'} - Last seen: ${subscription.last_seen_tag ?? 'none yet'}`

    const link = document.createElement('a')
    link.href = `https://github.com/${subscription.repo}`
    link.rel = 'noreferrer'
    link.target = '_blank'
    link.textContent = 'Open on GitHub'

    item.append(repo, meta, link)
    fragment.append(item)
  })

  elements.subscriptionList.append(fragment)
}

async function loadSubscriptions () {
  const email = readSavedEmail()

  if (!isEmailLike(email)) {
    setSubscriptionMessage('Save a valid email before loading subscriptions.')
    return
  }

  setSubscriptionMessage('Loading subscriptions...')

  try {
    const response = await fetch(`/subscriptions?email=${encodeURIComponent(email)}`)

    if (!response.ok) {
      setSubscriptionMessage('Subscriptions could not be loaded right now.')
      return
    }

    const subscriptions = await response.json()
    renderSubscriptions(Array.isArray(subscriptions) ? subscriptions : [])
  } catch {
    setSubscriptionMessage('Network trouble. Try loading subscriptions again.')
  }
}

function updateClock () {
  if (elements.clock === null) {
    return
  }

  const preferences = readPreferences()
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    hour12: preferences.clockFormat === '12',
    minute: '2-digit'
  })

  elements.clock.textContent = formatter.format(new Date())
}

function bindEvents () {
  elements.startButton?.addEventListener('click', () => {
    setMenuOpen(elements.menu?.hidden === true)
  })

  document.addEventListener('click', (event) => {
    if (
      elements.menu === null ||
      elements.startButton === null ||
      elements.menu.hidden ||
      !(event.target instanceof Node)
    ) {
      return
    }

    if (!elements.menu.contains(event.target) && !elements.startButton.contains(event.target)) {
      setMenuOpen(false)
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setMenuOpen(false)
    }
  })

  elements.triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const panelName = trigger.dataset.panelTrigger

      if (panelName !== undefined) {
        showPanel(panelName)
      }
    })
  })

  elements.subscribeForm?.addEventListener('submit', () => {
    const formData = new FormData(elements.subscribeForm)
    const email = formData.get('email')

    if (typeof email === 'string' && email.trim() !== '') {
      writeSavedEmail(email)
    }
  })

  elements.saveEmail?.addEventListener('click', () => {
    writeSavedEmail(elements.menuEmail?.value ?? '')
  })

  elements.saveAccount?.addEventListener('click', () => {
    writeSavedEmail(elements.accountEmail?.value ?? '')
  })

  elements.clearEmail?.addEventListener('click', () => {
    writeSavedEmail('')
    setSubscriptionMessage('Save an email, then load subscriptions.')
  })

  elements.clearLocalData?.addEventListener('click', () => {
    localStorage.removeItem(storageKeys.email)
    localStorage.removeItem(storageKeys.preferences)
    applyPreferences({ ...defaultPreferences })
    syncEmailFields()
    setSubscriptionMessage('Local taskbar data cleared.')
  })

  elements.loadSubscriptions?.addEventListener('click', () => {
    loadSubscriptions().catch(() => {
      setSubscriptionMessage('Network trouble. Try loading subscriptions again.')
    })
  })

  elements.preferenceControls.forEach((control) => {
    control.addEventListener('change', () => {
      const preferences = readPreferences()
      const key = control.dataset.preference

      if (key === 'clockFormat' || key === 'backgroundDim' || key === 'motion' || key === 'density') {
        preferences[key] = control.value
        writePreferences(preferences)
        updateClock()
      }
    })
  })
}

applyPreferences(readPreferences())
syncEmailFields()
showPanel('subscriptions')
bindEvents()
updateClock()
setInterval(updateClock, 30000)
