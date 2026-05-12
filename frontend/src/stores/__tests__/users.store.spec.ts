import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUsersStore } from '../users.store'

describe('useUsersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // @ts-ignore
    window.config = { API_URL: 'http://localhost:3000', WS_URL: 'http://localhost:3000' }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const makeUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'user-1',
    name: 'Alice Smith',
    email: 'alice@example.com',
    profilePictureUrl: null,
    githubId: 'alice',
    root: false,
    del: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  it('fetchUsers(params): calls GET /users with search and del params, stores paginated result', async () => {
    // Arrange
    const user1 = makeUser({ id: 'u1', name: 'Alice Smith' })
    const user2 = makeUser({ id: 'u2', name: 'Alice Wonder' })

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [user1, user2], total: 2, page: 1, limit: 10 }),
    } as Response)

    const store = useUsersStore()

    // Act
    await store.fetchUsers({ search: 'alice', del: 'false', page: 1, limit: 10 })

    // Assert
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('/users')
    expect(url).toContain('search=alice')
    expect(url).toContain('del=false')
    expect(store.users).toHaveLength(2)
    expect(store.total).toBe(2)
    expect(store.page).toBe(1)
    expect(store.limit).toBe(10)
  })

  it('updateUser(id, data): calls PATCH /users/:id, updates item in users array', async () => {
    // Arrange
    const existingUser = makeUser({ id: 'u1', name: 'Alice Smith' })
    const store = useUsersStore()
    store.$patch({ users: [existingUser] })

    const updatedUser = { ...existingUser, name: 'Alice Updated' }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => updatedUser,
    } as Response)

    // Act
    await store.updateUser('u1', { name: 'Alice Updated' })

    // Assert
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/u1'),
      expect.objectContaining({ method: 'PATCH' }),
    )
    const userInStore = store.users.find((u) => u.id === 'u1')
    expect(userInStore?.name).toBe('Alice Updated')
  })

  it('deleteUser(id): calls DELETE /users/:id, sets del=true on item in array', async () => {
    // Arrange
    const existingUser = makeUser({ id: 'u1', del: false })
    const store = useUsersStore()
    store.$patch({ users: [existingUser] })

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Deleted' }),
    } as Response)

    // Act
    await store.deleteUser('u1')

    // Assert
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/u1'),
      expect.objectContaining({ method: 'DELETE' }),
    )
    const userInStore = store.users.find((u) => u.id === 'u1')
    expect(userInStore?.del).toBe(true)
  })

  it('regenerateToken(id): calls POST /users/:id/regenerate-token', async () => {
    // Arrange
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ refreshToken: 'new-refresh-token-xyz' }),
    } as Response)

    const store = useUsersStore()

    // Act
    const result = await store.regenerateToken('u1')

    // Assert
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/u1/regenerate-token'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('fetchUsers(): on API error, stores error state', async () => {
    // Arrange
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal Server Error' }),
    } as Response)

    const store = useUsersStore()

    // Act
    await store.fetchUsers({ search: '', del: 'false', page: 1, limit: 10 })

    // Assert
    expect(store.users).toHaveLength(0)
    expect(store.error).toBeTruthy()
  })
})
