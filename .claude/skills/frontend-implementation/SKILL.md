---
name: frontend-implementation
description: Internal phase-3 skill dispatched by feature-router. Implements Vue 3 components/stores/composables until tests GREEN. Do not invoke directly — use /feature.
---

# Frontend Implementation — Vue 3 + Bootstrap 5

## 🔒 REGRA ABSOLUTA — Mapa é fonte única

`docs/CODEBASE.md` **já está no contexto** (injetado por hook PreToolUse). Cobre tudo: §1/§8 estrutura + feature index, §7 tipos centrais frontend, §10 índice de símbolos (stores, composables, views, components — paths exatos), §11 convenções Vue, **§12 skeletons canônicos (store Pinia, composable, view, component, rota Vue Router)**, §13 ponteiros para `docs/implementation/<feature>.md`.

### PROIBIDO
- `grep`, `find`, `ls` para "onde está X" ou "como outro componente fez Y".
- `Explore`, `Agent` (qualquer subagent de descoberta) para localizar arquivos, símbolos ou patterns.
- `Read` em `frontend/src/` **para inspiração de pattern existente** — use §12.

### PERMITIDO
- `Read` em `docs/specs/<feature>.md` e `docs/implementation/<feature>.md` (sob demanda, só o relevante).
- `Read`/`Edit`/`Write` no arquivo que você está editando agora.
- `grep`/`find` apenas para lógica interna não coberta pelo mapa nem pelos docs de implementação.

Se §12/§10/§13 não cobrirem seu caso, **pare e avise o usuário**. Não invente, não greppe.

Mapa desatualizado → pare e avise antes de prosseguir.

---

## Before Writing Any Code

1. Read the spec (`docs/specs/<feature>.md`) — understand ACs and ER diagram
2. Read the tests — understand what behavior is expected before touching source files
3. Identify which layer to start from (see order below)

---

## Folder Layout per Feature

```
frontend/
  src/
    orders/
      components/
        OrderCard.vue
        OrderList.vue
      views/
        OrdersView.vue
      stores/
        orders.store.ts
      composables/
        useOrders.ts
      types/
        order.types.ts
```

Rules:
- One folder per feature, named after the domain entity (kebab-case)
- `components/` — reusable, presentational components
- `views/` — page-level components wired to routes
- `stores/` — Pinia stores
- `composables/` — reusable reactive logic
- `types/` — TypeScript types/interfaces for this feature

---

## Vue 3 Composition API Conventions

- Always `<script setup>` — no Options API anywhere
- `defineProps<T>()` with explicit TypeScript interface — no runtime props object
- `defineEmits<T>()` with explicit event types
- `defineExpose()` only when tests need to reach internal state
- Props are read-only data in; emits are events out — never mutate a prop

```vue
<!-- components/OrderCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Order } from '../types/order.types'

const props = defineProps<{ order: Order }>()
const emit = defineEmits<{ cancel: [orderId: string] }>()

const canCancel = computed(() => ['Pending', 'Confirmed'].includes(props.order.status))

function handleCancel() {
  emit('cancel', props.order.id)
}
</script>

<template>
  <div class="card mb-3" data-test="order-card">
    <div class="card-body">
      <h5 class="card-title">Pedido #{{ order.id }}</h5>
      <span class="badge" :class="statusClass" data-test="status-badge">
        {{ order.status }}
      </span>
      <button
        v-if="canCancel"
        class="btn btn-outline-danger btn-sm"
        data-test="cancel-btn"
        @click="handleCancel"
      >
        Cancelar
      </button>
    </div>
  </div>
</template>
```

---

## Bootstrap 5 Conventions

### Layout
- `.container` / `.container-fluid` for page wrappers
- `.row` + `.col-*` for grid — always inside a `.container`
- Responsive: `col-12 col-md-6 col-lg-4` — mobile-first

### Components
- `.card` for content blocks
- `.btn btn-<variant>` for all buttons — never raw `<button>` without class
- `.badge bg-<color>` for status indicators
- `.alert alert-<variant>` for feedback messages
- `.modal` + `.modal-dialog` for dialogs — control visibility via `v-if` or Bootstrap's JS API
- `.navbar` for navigation

### Color and theming
- Use semantic color names: `.text-primary`, `.bg-danger`, `.border-success`
- Never hardcode raw colors in class attributes or inline styles
- No custom CSS unless Bootstrap utilities are genuinely insufficient — scope with `<style scoped>` if needed

### Testability
- Every interactive element gets a `data-test="..."` attribute
- Every meaningful container or list gets a `data-test="..."` attribute
- Never target elements by Bootstrap CSS class in tests — only `data-test` selectors

---

## Pinia Store Pattern

```ts
// stores/orders.store.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Order } from '../types/order.types'

export const useOrdersStore = defineStore('orders', () => {
  // State
  const items = ref<Order[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const pendingOrders = computed(() => items.value.filter(o => o.status === 'Pending'))

  // Actions
  async function fetchOrders() {
    isLoading.value = true
    error.value = null
    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      items.value = await res.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  async function cancelOrder(id: string) {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    items.value = items.value.filter(o => o.id !== id)
  }

  return { items, isLoading, error, pendingOrders, fetchOrders, cancelOrder }
})
```

### Store rules
- Always setup-style store (`defineStore('id', () => { ... })`) — not options-style
- Every async action: set `isLoading = true` at start, `false` in `finally`
- Every async action: catch errors, set `error` ref — never let uncaught rejections bubble
- Return only what components need — don't expose internal helpers
- Never call `fetch` from a component directly — always a store action

---

## Composable Pattern

```ts
// composables/useOrders.ts
import { computed } from 'vue'
import { useOrdersStore } from '../stores/orders.store'

export function useOrders() {
  const store = useOrdersStore()

  async function loadOrders() {
    await store.fetchOrders()
  }

  return {
    orders: computed(() => store.items),
    isLoading: computed(() => store.isLoading),
    error: computed(() => store.error),
    loadOrders,
    cancelOrder: store.cancelOrder,
  }
}
```

### Composable rules
- Names start with `use`
- Composables wrap stores or complex reactive logic — not thin wrappers for no reason
- Return computed refs (read-only), not raw store refs
- No `fetch` calls in composables — delegate to store actions

---

## Vue Router Conventions

```ts
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/orders',
      name: 'orders',
      component: () => import('../orders/views/OrdersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('../orders/views/OrderDetailView.vue'),
      meta: { requiresAuth: true },
      props: true,
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !localStorage.getItem('token')) {
    return { name: 'login' }
  }
})

export default router
```

### Router rules
- Named routes only — `router.push({ name: 'orders' })`, never `router.push('/orders')`
- Lazy-load all views with `() => import(...)`
- Auth guard belongs in `beforeEach`, not in components
- Route params via `props: true` — component receives them as typed `defineProps`
- Extend `RouteMeta` interface for typed `meta` fields

---

## View Component Pattern

```vue
<!-- views/OrdersView.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useOrders } from '../composables/useOrders'
import OrderList from '../components/OrderList.vue'

const { orders, isLoading, error, loadOrders, cancelOrder } = useOrders()

onMounted(loadOrders)
</script>

<template>
  <div class="container py-4">
    <h1 class="h3 mb-4">Meus Pedidos</h1>

    <div v-if="isLoading" class="text-center py-5" data-test="loading">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
    </div>

    <div v-else-if="error" class="alert alert-danger" data-test="error" role="alert">
      {{ error }}
    </div>

    <div v-else-if="orders.length === 0" class="text-center text-muted py-5" data-test="empty-state">
      Nenhum pedido encontrado.
    </div>

    <OrderList
      v-else
      :orders="orders"
      data-test="orders-list"
      @cancel="cancelOrder"
    />
  </div>
</template>
```

### View rules
- Views coordinate — they delegate logic to composables and rendering to components
- View > ~100 lines = extract a component
- Always handle all three states: loading, error, empty
- `onMounted` triggers data fetch — not in the store or composable constructor

---

## Order of Writing Code (TDD-Friendly)

Work layer by layer. Each step ends with tests green before moving to the next.

1. **Types** — define interfaces matching the spec ER diagram (`types/<feature>.types.ts`)
2. **Store** — state shape + async actions (run store unit tests; iterate until green)
3. **Composables** — if reusable logic needed (run composable tests; iterate until green)
4. **Leaf components** — `OrderCard`, `StatusBadge`, etc. (run component unit tests; iterate until green)
5. **Composite components** — `OrderList`, `OrderForm` (run component tests; iterate until green)
6. **Views** — page-level, wire everything together (run integration tests; iterate until green)
7. **Router config** — add routes, guards (run Playwright e2e tests; iterate until green)

Never move to the next layer with red tests.

---

## What Good Looks Like (Checklist)

- [ ] Every AC from the spec has a passing test referencing it by ID
- [ ] No `fetch` calls in components — all through store actions
- [ ] No raw CSS colors — Bootstrap utilities only, or scoped `<style>` as last resort
- [ ] All interactive elements and meaningful containers have `data-test` attributes
- [ ] Named routes everywhere — no magic path strings
- [ ] No Options API — `<script setup>` throughout
- [ ] No prop mutation — emit events instead
- [ ] `isLoading` + `error` + empty state handled in every view
- [ ] All views lazy-loaded in router
- [ ] TypeScript strict — no `any`, no non-null assertions without justification

---

## Anti-Patterns to Avoid

| Anti-pattern | Fix |
|---|---|
| `fetch` called directly in component | Move to store action |
| `router.push('/orders')` | Use `router.push({ name: 'orders' })` |
| Custom CSS for colors | Use Bootstrap semantic utilities |
| Options API (`data()`, `methods:`) | Rewrite as `<script setup>` |
| View component > ~100 lines | Extract child component |
| `store.items = [...]` from component | Call `store.fetchOrders()` or the relevant action |
| No `data-test` on interactive elements | Add before writing tests |
| `v-if="isLoading"` without error/empty state | Handle all three states |
| Non-lazy view imports | Use `() => import(...)` in router |

---

## Execution mode — subagent dispatch

Esta skill **delega a execução** ao subagent `frontend-implementation-agent` (`.claude/agents/frontend-implementation-agent.md`) para reduzir gasto de contexto na main thread. O subagent recebe contexto compacto (feature, paths relevantes), executa todo o trabalho (Read amplo, iteração test/lint/build, Write), e retorna apenas o bloco de status descrito no §Output do agent.

**Main thread (esta skill):**
1. Validar pré-condições (spec existe, ACs presentes, fases anteriores done).
2. Preparar prompt para o subagent: feature, spec path, contexto extra do usuário.
3. Invocar via Agent tool com `subagent_type: frontend-implementation-agent`.
4. Apresentar o retorno compacto ao usuário; se autonomy=pause, esperar aprovação.
5. Não duplicar trabalho do subagent inline na main.

**Quando NÃO usar subagent:**
- Tarefa trivial (typo em um teste, rename de uma constante) — edite direto.
- Usuário pediu explicitamente "faça você mesmo passo a passo".

Critérios de done, anti-patterns e regras detalhadas continuam descritos acima — o subagent segue esta SKILL.md como contrato.
