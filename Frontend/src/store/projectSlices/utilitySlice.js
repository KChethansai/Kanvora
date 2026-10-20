export const createUtilitySlice = (set, get) => ({
  loading: false,
  error: null,
  viewMode: 'kanban',
  savedFilters: JSON.parse(
    localStorage.getItem('project-saved-filters') || '[]'
  ),
  activeFilter: { search: '', priority: 'ALL', status: 'ALL' },
  undoStack: [],
  redoStack: [],
  cache: {},

  setViewMode: (viewMode) => set({ viewMode }),
  setActiveFilter: (filter) =>
    set((s) => ({ activeFilter: { ...s.activeFilter, ...filter } })),
  resetBoard: () => {
    get().resetListFetches?.()
    get().resetCardFetches?.()
    set({
      lists: [],
      cards: {},
      cardSavingIds: {},
      loadingLists: {},
      activeUsers: [],
      typingUsers: {},
      activityFeed: [],
      undoStack: [],
      redoStack: []
    })
  },
  saveFilter: (name) => {
    const next = [
      ...get().savedFilters.filter((item) => item.name !== name),
      { name, filter: get().activeFilter }
    ]
    localStorage.setItem('project-saved-filters', JSON.stringify(next))
    set({ savedFilters: next })
  },
  pushUndoSnapshot: () =>
    set((s) => ({
      undoStack: [...s.undoStack, { lists: s.lists, cards: s.cards }].slice(
        -20
      ),
      redoStack: []
    })),
  undo: () =>
    set((s) => {
      const previous = s.undoStack.at(-1)
      if (!previous) return {}
      return {
        lists: previous.lists,
        cards: previous.cards,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [{ lists: s.lists, cards: s.cards }, ...s.redoStack].slice(
          0,
          20
        )
      }
    }),
  redo: () =>
    set((s) => {
      const next = s.redoStack[0]
      if (!next) return {}
      return {
        lists: next.lists,
        cards: next.cards,
        redoStack: s.redoStack.slice(1),
        undoStack: [...s.undoStack, { lists: s.lists, cards: s.cards }].slice(
          -20
        )
      }
    })
})
