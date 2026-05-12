---
name: frontend-testing
description: Use this skill whenever the user wants to write tests for a Vue 3 frontend — component tests, integration tests, or Playwright e2e tests. Covers Vitest + Vue Test Utils + @testing-library/vue patterns, Pinia store testing, Vue Router integration, and Playwright browser tests. Triggers on phrases like "write tests for", "test this component", "unit test", "component test", "e2e test", "playwright", "TDD this", "test the view", or "add coverage for". Use this skill even if the user only mentions one test layer — it handles all three coherently. This is phase 2 of a spec → test → code → doc workflow; tests written here should map 1:1 to acceptance criteria from the spec phase, and the implementation phase makes them pass.
---

# Frontend Testing — Vitest + Vue Test Utils + Playwright

## Three Layers

| Layer | Question | Scope | Speed | Mock |
|---|---|---|---|---|
| Component (unit) | Component render + behavior correct? | One `.vue` file | ms | All external deps (stores, router, fetch) |
| Integration | Components + stores + router wire together? | Feature sub-tree + real Pinia + real Router | tens of ms | HTTP (`vi.mock` fetch/axios), external APIs |
| E2E | User flows work in browser? | Full app running (dev server) | seconds | None (real backend or MSW) |

---

## When to Invoke

- "write tests for"
- "test this component"
- "unit test"
- "component test"
- "e2e test"
- "playwright"
- "TDD this"
- "test the view"
- "add coverage for"
- Any phase 2 request in the spec → test → code → doc workflow

---

## File Layout and Naming

```
frontend/
  src/
    orders/
      components/
        OrderList.vue
        OrderList.spec.ts       # component unit test
        OrderCard.vue
        OrderCard.spec.ts
      views/
        OrdersView.vue
        OrdersView.spec.ts      # integration (view + store + router)
      stores/
        orders.store.ts
        orders.store.spec.ts    # unit test for Pinia store
      composables/
        useOrders.ts
        useOrders.spec.ts       # unit test for composable
  e2e/
    orders.spec.ts              # Playwright e2e
```

Rules:
- Test files live next to the source file they test (except e2e, which lives in `e2e/`)
- Naming: `<name>.spec.ts` for Vitest, `<feature>.spec.ts` for Playwright
- One spec file per source file — no omnibus test files

---

## Anatomy of Every Test (AAA)

Every test follows Arrange → Act → Assert with a blank line between phases. No exceptions.

```ts
it('AC-3: shows cancel button only when status is Pending', () => {
  // Arrange
  const wrapper = mount(OrderCard, {
    props: { orderId: 'o1' },
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            orders: { items: [{ id: 'o1', status: 'Pending', total: 100 }] }
          }
        })
      ]
    }
  })

  // Act — (none needed for render-only assertions)

  // Assert
  expect(wrapper.find('[data-test="cancel-btn"]').exists()).toBe(true)
})
```

---

## Map ACs to Tests

Every test name references the AC it covers. Use the same ID from the spec document.

```ts
it('AC-1: fetchOrders populates items from API response', ...)
it('AC-2: renders order list after successful fetch', ...)
it('AC-3: shows cancel button only when status is Pending', ...)
it('AC-4: hides cancel button when status is Shipped', ...)
```

Minimum: one test per AC. An AC with multiple edge cases gets multiple tests, all labeled with the same AC ID.

---

## Layer 1 — Component Unit Tests

### Setup rules
- Use `mount` or `shallowMount` from `@vue/test-utils`
- Mock Pinia with `createTestingPinia` from `@pinia/testing`
- Mock Vue Router with `vi.fn()` stubs
- Mock `fetch` or axios via `vi.stubGlobal` or `vi.mock`
- Call `setActivePinia(createPinia())` or use `createTestingPinia` — never share state between tests

### Assert
- Rendered text content
- CSS classes and their conditions
- Emitted events (`wrapper.emitted()`)
- Slot content
- Element existence (`exists()`, `isVisible()`)
- Element count (`findAll(...).length`)

### Component with store example

```ts
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { vi } from 'vitest'
import OrderCard from './OrderCard.vue'

describe('OrderCard', () => {
  it('AC-3: shows cancel button only when status is Pending', () => {
    // Arrange
    const wrapper = mount(OrderCard, {
      props: { orderId: 'o1' },
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              orders: { items: [{ id: 'o1', status: 'Pending', total: 100 }] }
            }
          })
        ]
      }
    })

    // Assert
    expect(wrapper.find('[data-test="cancel-btn"]').exists()).toBe(true)
  })

  it('AC-4: hides cancel button when status is Shipped', () => {
    // Arrange
    const wrapper = mount(OrderCard, {
      props: { orderId: 'o1' },
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              orders: { items: [{ id: 'o1', status: 'Shipped', total: 100 }] }
            }
          })
        ]
      }
    })

    // Assert
    expect(wrapper.find('[data-test="cancel-btn"]').exists()).toBe(false)
  })

  it('AC-5: emits cancel event with orderId when cancel button clicked', async () => {
    // Arrange
    const wrapper = mount(OrderCard, {
      props: { orderId: 'o1' },
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              orders: { items: [{ id: 'o1', status: 'Pending', total: 100 }] }
            }
          })
        ]
      }
    })

    // Act
    await wrapper.find('[data-test="cancel-btn"]').trigger('click')

    // Assert
    expect(wrapper.emitted('cancel')).toEqual([['o1']])
  })
})
```

---

## Layer 1 — Pinia Store Unit Tests

### Setup rules
- Call `setActivePinia(createPinia())` in `beforeEach` — fresh store per test
- Stub `fetch` with `vi.stubGlobal('fetch', vi.fn())`
- Call `vi.restoreAllMocks()` in `afterEach`

```ts
import { setActivePinia, createPinia } from 'pinia'
import { vi } from 'vitest'
import { useOrdersStore } from './orders.store'

describe('useOrdersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => vi.restoreAllMocks())

  it('AC-1: fetchOrders populates items from API response', async () => {
    // Arrange
    const mockOrders = [{ id: 'o1', status: 'Pending', total: 100 }]
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockOrders,
    } as Response)

    const store = useOrdersStore()

    // Act
    await store.fetchOrders()

    // Assert
    expect(store.items).toEqual(mockOrders)
  })

  it('AC-6: sets error when API returns non-ok response', async () => {
    // Arrange
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response)
    const store = useOrdersStore()

    // Act
    await store.fetchOrders()

    // Assert
    expect(store.error).toMatch('500')
    expect(store.items).toHaveLength(0)
  })

  it('AC-7: isLoading is true during fetch and false after', async () => {
    // Arrange
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)
    const store = useOrdersStore()

    // Act
    const promise = store.fetchOrders()
    expect(store.isLoading).toBe(true)
    await promise

    // Assert
    expect(store.isLoading).toBe(false)
  })
})
```

---

## Layer 1 — Composable Unit Tests

```ts
import { vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOrders } from './useOrders'

describe('useOrders', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => vi.restoreAllMocks())

  it('AC-5: isLoading is true while fetch is in progress', async () => {
    // Arrange
    let resolve!: (value: unknown) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise(r => { resolve = r })))

    const { isLoading, loadOrders } = useOrders()

    // Act
    const promise = loadOrders()
    expect(isLoading.value).toBe(true)

    resolve({ ok: true, json: async () => [] })
    await promise

    // Assert
    expect(isLoading.value).toBe(false)
  })
})
```

---

## Layer 2 — Integration Tests (View + Store + Router)

### Setup rules
- Use real Pinia (`createPinia()`) — not `createTestingPinia`
- Use real Vue Router with `createMemoryHistory`
- Stub HTTP (`fetch` or axios) — no real network calls
- Import the full view component
- Use `await router.isReady()` before asserting navigation-dependent state
- Use `await flushPromises()` after async store actions

```ts
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { vi } from 'vitest'
import OrdersView from './OrdersView.vue'

describe('OrdersView (integration)', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    setActivePinia(createPinia())
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/orders', component: OrdersView }],
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => vi.restoreAllMocks())

  it('AC-2: renders order list after successful fetch', async () => {
    // Arrange
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'o1', status: 'Pending', total: 100 }],
    } as Response)

    const wrapper = mount(OrdersView, {
      global: { plugins: [router, createPinia()] },
    })

    await router.isReady()

    // Act
    await wrapper.find('[data-test="load-btn"]').trigger('click')
    await flushPromises()

    // Assert
    expect(wrapper.findAll('[data-test="order-card"]')).toHaveLength(1)
  })

  it('AC-8: shows error alert when fetch fails', async () => {
    // Arrange
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response)

    const wrapper = mount(OrdersView, {
      global: { plugins: [router, createPinia()] },
    })

    await router.isReady()

    // Act
    await wrapper.find('[data-test="load-btn"]').trigger('click')
    await flushPromises()

    // Assert
    expect(wrapper.find('[data-test="error"]').exists()).toBe(true)
  })
})
```

---

## Layer 3 — Playwright E2E

### playwright.config.ts

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Test example

```ts
import { test, expect } from '@playwright/test'

test.describe('Orders flow', () => {
  test('AC-1: authenticated user can view orders list', async ({ page }) => {
    // Arrange
    await page.goto('/login')
    await page.fill('[data-test="email"]', 'test@example.com')
    await page.fill('[data-test="password"]', 'password')
    await page.click('[data-test="submit"]')

    // Act
    await page.goto('/orders')

    // Assert
    await expect(page.locator('[data-test="orders-list"]')).toBeVisible()
  })

  test('AC-2: order card shows status badge', async ({ page }) => {
    // Arrange
    await page.goto('/orders')

    // Act
    const firstCard = page.locator('[data-test="order-card"]').first()

    // Assert
    await expect(firstCard.locator('[data-test="status-badge"]')).toBeVisible()
  })

  test('AC-9: unauthenticated user is redirected to login', async ({ page }) => {
    // Arrange — clear auth state
    await page.context().clearCookies()

    // Act
    await page.goto('/orders')

    // Assert
    await expect(page).toHaveURL(/\/login/)
  })
})
```

### Playwright vs Vitest decision guide

| Use Playwright for | Use Vitest for |
|---|---|
| User-visible flows (login, navigation) | Store actions and state transitions |
| Form submission and validation messages | Composable reactive behavior |
| Toast notifications and modal dialogs | Component conditional rendering |
| Auth redirects | Emitted events |
| Empty state and 404 pages | Computed property logic |
| Cross-page navigation | API error handling in store |

---

## Coverage Strategy

### Component tests
- Every prop variation (all meaningful values of each prop)
- Every conditional render (`v-if`, `v-show`) — one test for true path, one for false
- Every emitted event — verify payload

### Integration tests
- Every route the view appears on
- Every user action (button click, form submit, navigation)
- Every API response shape: success, empty list, error

### E2E tests
- At minimum one Playwright test per AC in the spec
- Highest-risk paths: auth redirect, 404, empty state, network error feedback

---

## What This Skill Will NOT Do

- No Cypress — Playwright only for browser automation
- No snapshot tests for component output — assert specific elements and classes, not serialized HTML blobs
- No testing Bootstrap component internals — test your app's behavior, not the library

---

## Common Mistakes to Avoid

- **Forgetting `await flushPromises()` or `await nextTick()`** after async store actions — the DOM won't update synchronously
- **Not resetting mocks** — call `vi.restoreAllMocks()` in `afterEach`
- **Leaking Pinia state** between tests — call `setActivePinia(createPinia())` in `beforeEach`
- **Playwright tests relying on animation timing** — use `waitFor` / `toBeVisible()` patterns, never fixed `sleep`
- **Testing Bootstrap CSS classes** instead of behavior — if you're asserting `.btn-danger` exists, you're testing Bootstrap, not your app
- **Missing `await router.isReady()`** in integration tests before asserting navigation-dependent renders
