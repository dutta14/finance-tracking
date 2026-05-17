import { Page, Locator } from '@playwright/test'

export class GoalsPage {
  readonly page: Page

  // Header
  readonly header: Locator
  readonly headerActions: Locator
  readonly newGoalBtn: Locator

  // Tab Bar
  readonly tabBar: Locator
  readonly plansTab: Locator
  readonly calculatorTab: Locator
  readonly activeTab: Locator

  // Mini Grid / List
  readonly miniGrid: Locator
  readonly miniList: Locator
  readonly miniCards: Locator
  readonly dragItems: Locator

  // View Mode Toggle
  readonly viewModeToggle: Locator
  readonly gridViewBtn: Locator
  readonly listViewBtn: Locator

  // Context Menu
  readonly contextMenu: Locator
  readonly contextMenuItems: Locator
  readonly contextMenuOpen: Locator
  readonly contextMenuRename: Locator
  readonly contextMenuDuplicate: Locator
  readonly contextMenuDelete: Locator

  // Inline Rename
  readonly renameContainer: Locator
  readonly renameInput: Locator

  // Empty State
  readonly emptyState: Locator

  // Wizard Modal
  readonly wizardModal: Locator
  readonly wizardBackdrop: Locator
  readonly wizardTitle: Locator
  readonly wizardCloseBtn: Locator
  readonly wizardDots: Locator
  readonly wizardActiveDot: Locator
  readonly wizardDoneDot: Locator
  readonly wizardStep: Locator
  readonly wizardNameInput: Locator
  readonly wizardCreatedInInput: Locator
  readonly wizardEndYearInput: Locator
  readonly wizardRetirementAgeInput: Locator
  readonly wizardExpenseInput: Locator
  readonly wizardParamInputs: Locator
  readonly wizardBackBtn: Locator
  readonly wizardNextBtn: Locator
  readonly wizardCreateBtn: Locator
  readonly templatePickerToggle: Locator
  readonly templatePicker: Locator
  readonly templateCards: Locator
  readonly randomNameBtn: Locator
  readonly formError: Locator
  readonly wizardReview: Locator
  readonly wizardReviewRows: Locator
  readonly useRecommendedBtn: Locator

  // Goal Detail
  readonly goalDetail: Locator
  readonly detailBackLink: Locator
  readonly detailTitle: Locator
  readonly detailStepper: Locator
  readonly detailPrevBtn: Locator
  readonly detailNextBtn: Locator
  readonly detailActionsTrigger: Locator
  readonly detailActionsMenu: Locator
  readonly detailEditBtn: Locator
  readonly detailDuplicateBtn: Locator
  readonly detailDeleteBtn: Locator

  // FI Card Editing
  readonly fiCardEditBtn: Locator
  readonly fiCardEditForm: Locator

  // Undo
  readonly undoBtn: Locator
  readonly undoToast: Locator

  // Sidebar
  readonly sidebarCollapseBtn: Locator
  readonly sidebarOverlay: Locator

  // Error Boundary
  readonly errorBoundaryCard: Locator

  // Goal Section (data-corruption fallback)
  readonly goalSection: Locator

  // GW Section
  readonly gwSection: Locator
  readonly gwGoalCards: Locator
  readonly gwGoalLabels: Locator
  readonly gwAddBtn: Locator
  readonly gwAddForm: Locator
  readonly gwEditForm: Locator
  readonly gwFormInputs: Locator
  readonly gwFormLabelInput: Locator
  readonly gwFormDisburseAgeInput: Locator
  readonly gwFormAmountInput: Locator
  readonly gwFormSave: Locator
  readonly gwFormCancel: Locator
  readonly gwUndoBar: Locator
  readonly gwUndoBtn: Locator
  readonly gwEmptyState: Locator

  // Reorder (mobile)
  readonly reorderTouchControls: Locator
  readonly reorderMoveBtns: Locator
  readonly reorderAnnouncement: Locator
  // Reorder (keyboard)
  readonly grabHandles: Locator

  // Compare
  readonly compareBtn: Locator
  readonly selectionBar: Locator
  readonly selectionCount: Locator

  // Calculator
  readonly calculatorLoading: Locator

  constructor(page: Page) {
    this.page = page

    this.header = page.locator('.goal-header')
    this.headerActions = page.locator('.goal-header-actions')
    this.newGoalBtn = page.getByRole('button', { name: '+ New Goal' })

    this.tabBar = page.locator('.goal-tab-bar')
    this.plansTab = page.locator('.goal-tab', { hasText: 'Plans' })
    this.calculatorTab = page.locator('.goal-tab', { hasText: 'Calculator' })
    this.activeTab = page.locator('.goal-tab.active')

    this.miniGrid = page.locator('.goals-mini-grid')
    this.miniList = page.locator('.goals-mini-list')
    this.miniCards = page.locator('.goal-mini-card')
    this.dragItems = page.locator('.goal-drag-item')

    this.viewModeToggle = page.locator('.view-mode-toggle')
    this.gridViewBtn = page.getByLabel('Grid view')
    this.listViewBtn = page.getByLabel('List view')

    this.contextMenu = page.locator('.card-context-menu')
    this.contextMenuItems = page.locator('.card-context-menu-item')
    this.contextMenuOpen = page.locator('.card-context-menu-item', { hasText: 'Open' })
    this.contextMenuRename = page.locator('.card-context-menu-item', { hasText: 'Rename' })
    this.contextMenuDuplicate = page.locator('.card-context-menu-item', { hasText: 'Duplicate' })
    this.contextMenuDelete = page.locator('.card-context-menu-item--danger')

    this.renameContainer = page.locator('.goal-rename-inline')
    this.renameInput = page.locator('.goal-rename-input')

    this.emptyState = page.locator('.empty-state')

    this.wizardModal = page.locator('.goal-form-modal')
    this.wizardBackdrop = page.locator('.goal-form-modal-backdrop')
    this.wizardTitle = page.locator('.wizard-header h2')
    this.wizardCloseBtn = page.getByLabel('Close')
    this.wizardDots = page.locator('.wizard-dot')
    this.wizardActiveDot = page.locator('.wizard-dot.active')
    this.wizardDoneDot = page.locator('.wizard-dot.done')
    this.wizardStep = page.locator('.wizard-step')
    this.wizardNameInput = page.locator('.wizard-input[name="goalName"]')
    this.wizardCreatedInInput = page.locator('.wizard-input[name="goalCreatedIn"]')
    this.wizardEndYearInput = page.locator('.wizard-input[name="goalEndYear"]')
    this.wizardRetirementAgeInput = page.locator('.wizard-input[name="retirementAge"]')
    this.wizardExpenseInput = page.locator('.wizard-input[name="expenseValue"]')
    this.wizardParamInputs = page.locator('.wizard-param-input[type="number"]')
    this.wizardBackBtn = page.locator('.wizard-btn--back')
    this.wizardNextBtn = page.locator('.wizard-btn--next')
    this.wizardCreateBtn = page.locator('.wizard-btn--create')
    this.templatePickerToggle = page.locator('.btn-use-template')
    this.templatePicker = page.locator('.template-picker')
    this.templateCards = page.locator('.template-card')
    this.randomNameBtn = page.locator('.random-name-btn')
    this.formError = page.locator('.form-error[role="alert"]')
    this.wizardReview = page.locator('.wizard-review')
    this.wizardReviewRows = page.locator('.wizard-review-row')
    this.useRecommendedBtn = page.locator('.btn-use-recommended')

    this.goalDetail = page.locator('.goal-detail')
    this.detailBackLink = page.locator('.goal-detail-back-link')
    this.detailTitle = page.locator('.goal-detail-title')
    this.detailStepper = page.getByRole('group', { name: 'Goal navigation' })
    this.detailPrevBtn = page.getByLabel('Previous goal')
    this.detailNextBtn = page.getByLabel('Next goal')
    this.detailActionsTrigger = page.getByLabel('Goal actions')
    this.detailActionsMenu = page.locator('.goal-actions-menu')
    this.detailEditBtn = page.locator('.goal-actions-menu-item', { hasText: 'Edit' })
    this.detailDuplicateBtn = page.locator('.goal-actions-menu-item', { hasText: 'Duplicate' })
    this.detailDeleteBtn = page.locator('.goal-actions-menu-item--danger')

    this.gwSection = page.locator('.gw-section')
    this.gwGoalCards = page.locator('.gw-goal-card')
    this.gwGoalLabels = page.locator('.gw-goal-label')
    this.gwAddBtn = page.locator('.gw-add-btn').first()
    this.gwAddForm = page.locator('.gw-form')
    this.gwEditForm = page.locator('.gw-card-edit-form')
    this.gwFormInputs = page.locator('.gw-form-input')
    // GW form labels aren't associated via for/id, so use positional within scoped form
    this.gwFormLabelInput = page.locator('.gw-form .gw-form-input').nth(0)
    this.gwFormDisburseAgeInput = page.locator('.gw-form .gw-form-input').nth(1)
    this.gwFormAmountInput = page.locator('.gw-form .gw-form-input').nth(2)
    this.gwFormSave = page.locator('.gw-form-save')
    this.gwFormCancel = page.locator('.gw-form-cancel')
    this.gwUndoBar = page.locator('.gw-goal-undo-bar')
    this.gwUndoBtn = page.locator('.gw-goal-undo-btn')
    this.gwEmptyState = page.locator('.gw-empty-state')

    this.fiCardEditBtn = page.locator('.fi-card-edit-btn')
    this.fiCardEditForm = page.locator('.fi-card-edit-form')
    this.undoBtn = page.getByRole('button', { name: /undo/i })
    this.undoToast = page.locator('[role="alert"]')
    this.sidebarCollapseBtn = page.getByRole('button', { name: /collapse sidebar/i })
    this.sidebarOverlay = page.locator('.sidebar-overlay')
    this.errorBoundaryCard = page.locator('.error-boundary-card')
    this.goalSection = page.locator('.goal')

    this.reorderTouchControls = page.locator('.reorder-touch-controls.goal-reorder-touch-controls')
    this.reorderMoveBtns = page.locator('.reorder-move-btn')
    this.reorderAnnouncement = page.locator('[aria-live="polite"].sr-only:not([role="status"])')
    this.grabHandles = page.locator('.goal-grab-handle')

    this.compareBtn = page.locator('.goal-compare-btn')
    this.selectionBar = page.locator('.goal-selection-bar')
    this.selectionCount = page.locator('.goal-selection-count')

    this.calculatorLoading = page.locator('.goal-tab-loading[role="status"]')
  }

  async goto() {
    await this.page.goto('/finance-tracking/#/goal')
    await this.page.waitForLoadState('domcontentloaded')
  }

  async gotoDetail(goalId: number) {
    await this.page.goto(`/finance-tracking/#/goal/${goalId}`)
    await this.page.waitForLoadState('domcontentloaded')
  }

  async gotoCalculator() {
    await this.page.goto('/finance-tracking/#/goal/calculator')
    await this.page.waitForLoadState('domcontentloaded')
  }

  getMiniCardByName(name: string): Locator {
    return this.miniCards.filter({ hasText: name })
  }

  getMiniCardName(index: number): Locator {
    return this.miniCards.nth(index).locator('.mini-card-top h4')
  }

  getMiniCardProgress(index: number): Locator {
    return this.miniCards.nth(index).locator('.mini-progress-pct')
  }

  getMiniCardAmount(index: number): Locator {
    return this.miniCards.nth(index).locator('.mini-value .amount')
  }

  getMoveUpBtn(name: string): Locator {
    return this.page.getByLabel(`Move ${name} up`)
  }

  getMoveDownBtn(name: string): Locator {
    return this.page.getByLabel(`Move ${name} down`)
  }

  async openContextMenu(cardLocator: Locator) {
    await cardLocator.click({ button: 'right' })
  }

  async openDetailActions() {
    await this.detailActionsTrigger.click()
  }

  async completeWizardStep1(name: string) {
    await this.wizardNameInput.fill(name)
    await this.wizardNextBtn.click()
  }

  async completeWizardStep2(opts: { createdIn?: string; endYear?: string; retirementAge?: string } = {}) {
    if (opts.createdIn) await this.wizardCreatedInInput.fill(opts.createdIn)
    if (opts.endYear) await this.wizardEndYearInput.fill(opts.endYear)
    if (opts.retirementAge) await this.wizardRetirementAgeInput.fill(opts.retirementAge)
    await this.wizardNextBtn.click()
  }

  async completeWizardStep3(expense?: string) {
    if (expense) await this.wizardExpenseInput.fill(expense)
    await this.wizardNextBtn.click()
  }

  async completeWizardStep4() {
    await this.wizardNextBtn.click()
  }

  async submitWizard() {
    await this.wizardCreateBtn.click()
  }
}
