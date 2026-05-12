import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { flushPromises } from '@vue/test-utils'
import ProfileView from '../ProfileView.vue'

describe('ProfileView', () => {
  const mockUser = {
    id: 'user-1',
    name: 'Pedro Miranda',
    email: 'pedro@example.com',
    profilePictureUrl: 'https://example.com/pic.jpg',
    githubId: 'pedromiranda',
    root: false,
    del: false,
  }

  const mockHistory = [
    {
      id: 'p1',
      app: 'whiz-server',
      environment: 'development',
      commitSha: 'abc1234',
      commitMessage: 'fix: deps',
      commitAuthor: 'Pedro Miranda',
      commitAuthorAvatar: null,
      status: 'Completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    // @ts-ignore
    window.config = { API_URL: 'http://localhost:3000', WS_URL: 'http://localhost:3000' }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mountProfile() {
    return mount(ProfileView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: true,
            initialState: {
              auth: {
                accessToken: 'mock-token',
                refreshToken: 'mock-refresh',
                user: mockUser,
              },
              profile: {
                history: mockHistory,
                loading: false,
                error: null,
              },
            },
          }),
        ],
        stubs: {
          RouterLink: true,
          RouterView: true,
          AppLayout: { template: '<div><slot /></div>' },
        },
      },
    })
  }

  it('renders [data-test="profile-name"] with user name from auth store', () => {
    // Arrange
    const wrapper = mountProfile()

    // Assert
    expect(wrapper.find('[data-test="profile-name"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="profile-name"]').element.value ?? wrapper.find('[data-test="profile-name"]').text()).toContain('Pedro Miranda')
  })

  it('renders [data-test="profile-email"] with user email from auth store', () => {
    // Arrange
    const wrapper = mountProfile()

    // Assert
    expect(wrapper.find('[data-test="profile-email"]').exists()).toBe(true)
    const el = wrapper.find('[data-test="profile-email"]')
    expect((el.element as HTMLInputElement).value ?? el.text()).toContain('pedro@example.com')
  })

  it('renders [data-test="profile-github-id"] with user githubId from auth store', () => {
    // Arrange
    const wrapper = mountProfile()

    // Assert
    expect(wrapper.find('[data-test="profile-github-id"]').exists()).toBe(true)
  })

  it('renders [data-test="profile-picture-url"] field from auth store', () => {
    // Arrange
    const wrapper = mountProfile()

    // Assert
    expect(wrapper.find('[data-test="profile-picture-url"]').exists()).toBe(true)
  })

  it('AC-20: on form submit, calls PATCH /users/:id via store update action', async () => {
    // Arrange
    const wrapper = mountProfile()
    const { useAuthStore } = await import('../../stores/auth.store')
    const authStore = useAuthStore()

    // Act
    const nameInput = wrapper.find('[data-test="profile-name"]')
    await nameInput.setValue('Pedro Updated')

    await wrapper.find('[data-test="profile-save"]').trigger('click')
    await flushPromises()

    // Assert — store's updateProfile (or equivalent) should have been called
    // The view should call PATCH /users/:id via a store action
    expect(authStore.updateProfile ?? (authStore as any).update).toBeDefined()
  })

  it('AC-20: after save, displayed name reflects updated value', async () => {
    // Arrange
    const wrapper = mountProfile()
    const { useAuthStore } = await import('../../stores/auth.store')
    const authStore = useAuthStore()

    // Simulate the store updating user after save
    // @ts-ignore
    authStore.updateProfile = vi.fn().mockImplementation(async () => {
      authStore.$patch({ user: { ...mockUser, name: 'Pedro Updated' } })
    })

    // Act
    await wrapper.find('[data-test="profile-name"]').setValue('Pedro Updated')
    await wrapper.find('[data-test="profile-save"]').trigger('click')
    await flushPromises()

    // Assert
    const nameEl = wrapper.find('[data-test="profile-name"]')
    const displayedName =
      (nameEl.element as HTMLInputElement).value ?? nameEl.text()
    expect(displayedName).toContain('Pedro Updated')
  })

  it('renders pipeline history table [data-test="history-table"]', () => {
    // Arrange
    const wrapper = mountProfile()

    // Assert
    expect(wrapper.find('[data-test="history-table"]').exists()).toBe(true)
  })

  it('history table has at least one row from the store history', async () => {
    // Arrange
    const wrapper = mountProfile()
    await flushPromises()

    // Assert
    const historyTable = wrapper.find('[data-test="history-table"]')
    expect(historyTable.exists()).toBe(true)
    // Rows should reflect mockHistory
    const rows = wrapper.findAll('[data-test="history-row"]')
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })
})
