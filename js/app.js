/**
 * app.js - Main Game Controller for the Math Study Game.
 * Manages game state (XP, stars, streak, badges, progress), saves/loads to localStorage,
 * handles submissions for all question types, renders LaTeX formulas, and updates the UI.
 */

// ----------------------------------------------------
// Global Badges Configuration
// ----------------------------------------------------
const BADGES = {
  first_steps: { id: "first_steps", name: "צעדים ראשונים", icon: "🌱", desc: "פתרת את השאלה הראשונה שלך בהצלחה!" },
  world_1_master: { id: "world_1_master", name: "אלוף נגזרות השורש", icon: "🧪", desc: "השלמת את כל השלבים בעולם נגזרות של פונקציית שורש!" },
  world_2_master: { id: "world_2_master", name: "מומחה למשיקים", icon: "📐", desc: "השלמת את כל השלבים בעולם משיקים ופרמטרים!" },
  world_3_master: { id: "world_3_master", name: "חוקר פונקציות מדופלם", icon: "📊", desc: "השלמת את כל השלבים בעולם חקירה מלאה של פונקציות!" },
  world_4_master: { id: "world_4_master", name: "אשף הטרנספורמציות", icon: "📈", desc: "השלמת את כל השלבים בעולם טרנספורמציות ונגזרות!" },
  streak_3: { id: "streak_3", name: "התמדה של פלדה", icon: "🔥", desc: "הגעת לרצף למידה של 3 ימים!" },
  xp_100: { id: "xp_100", name: "חניך מצטיין", icon: "🎖️", desc: "צברת 100 נקודות ניסיון (XP)!" },
  xp_500: { id: "xp_500", name: "רב-אמן במתמטיקה", icon: "👑", desc: "צברת 500 נקודות ניסיון (XP)!" }
};

class GameController {
  constructor() {
    this.state = this.getInitialState();
    
    // Level gameplay stats
    this.currentQuestion = null;
    this.timerId = null;
    this.levelSeconds = 0;
    this.levelAttempts = 0;
    this.levelCorrect = 0;
    this.hintsShown = 0;

    // Temporary interaction states
    this.selectedMatchingItem = null; // matching left selection
    this.matchingUserPairs = {}; // matching matched pairs { leftText: rightText }
    this.selectedDragItem = null; // drag-drop-slots click-to-move selection
    this.isAnswerChecked = false; // flag to block multiple submissions on success

    // Bind methods to maintain context
    this.init = this.init.bind(this);
    this.submitAnswer = this.submitAnswer.bind(this);
    this.nextQuestion = this.nextQuestion.bind(this);
    this.backToMap = this.backToMap.bind(this);
    this.resetProgress = this.resetProgress.bind(this);
    this.onWorldChange = this.onWorldChange.bind(this);
    this.quickPlay = this.quickPlay.bind(this);
    this.showExitWarningModal = this.showExitWarningModal.bind(this);
    this.hideExitWarningModal = this.hideExitWarningModal.bind(this);
    this.showComingSoonModal = this.showComingSoonModal.bind(this);
    this.hideComingSoonModal = this.hideComingSoonModal.bind(this);
  }

  getInitialState() {
    const saved = localStorage.getItem('math_game_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure default properties exist
        return Object.assign({
          xp: 0,
          stars: 0,
          streak: 0,
          lastPlayedDate: null,
          currentWorldId: "world_1",
          currentLevelId: "w1_l1",
          currentQuestionIndex: 0,
          completedLevels: {},
          badges: [],
          totalAttempts: 0,
          totalCorrect: 0,
          view: "map"
        }, parsed);
      } catch (e) {
        console.error("Error parsing saved state, initializing default state.", e);
      }
    }
    return {
      xp: 0,
      stars: 0,
      streak: 0,
      lastPlayedDate: null,
      currentWorldId: "world_1",
      currentLevelId: "w1_l1",
      currentQuestionIndex: 0,
      completedLevels: {},
      badges: [],
      totalAttempts: 0,
      totalCorrect: 0,
      view: "map"
    };
  }

  saveState() {
    localStorage.setItem('math_game_state', JSON.stringify(this.state));
  }

  resetProgress() {
    if (confirm("האם אתה בטוח שברצונך לאפס את כל ההתקדמות שלך במשחק? פעולה זו תמחק את ה-XP, הכוכבים והתגים שצברת.")) {
      localStorage.removeItem('math_game_state');
      this.state = this.getInitialState();
      this.saveState();
      this.updateTopBar();
      this.renderWorldMap();
      this.showView("map");
    }
  }

  init() {
    this.updateTopBar();
    this.bindEvents();
    
    // Set world select dropdown to match state
    const worldSelect = document.getElementById('world-select');
    if (worldSelect) {
      worldSelect.value = this.state.currentWorldId;
    }

    // Render initial view
    if (this.state.view === "game") {
      this.resumeLevel();
    } else {
      this.renderWorldMap();
      this.showView("map");
    }

    // Render math formulas
    this.renderMath(document.body);
  }

  bindEvents() {
    // Header Reset Button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', this.resetProgress);
    } else {
      // If not present in HTML, look for class or generic binding if needed
      this.safeBind('reset-btn', 'click', this.resetProgress);
    }

    // Gameplay Screen Actions
    this.safeBind('btn-submit-answer', 'click', this.submitAnswer);
    this.safeBind('btn-exit-game', 'click', () => this.showExitWarningModal());
    this.safeBind('btn-exit-confirm', 'click', () => {
      this.hideExitWarningModal();
      this.backToMap();
    });
    this.safeBind('btn-exit-cancel', 'click', () => this.hideExitWarningModal());
    this.safeBind('btn-coming-soon-close', 'click', () => this.hideComingSoonModal());
    this.safeBind('btn-show-hint', 'click', () => this.toggleHintTooltip(true));
    this.safeBind('btn-close-hint', 'click', () => this.toggleHintTooltip(false));

    // Summary Screen Actions
    this.safeBind('btn-summary-map', 'click', this.backToMap);
    this.safeBind('btn-summary-next', 'click', this.quickPlay);

    // Sidebar Action
    this.safeBind('btn-quick-play', 'click', this.quickPlay);

    // World Select Change
    const worldSelect = document.getElementById('world-select');
    if (worldSelect) {
      worldSelect.addEventListener('change', this.onWorldChange);
    }

    // Tab Navigation: Map tab click returns to map screen
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Block header tabs navigation when game is active
        if (this.state.view === "game") {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const target = btn.dataset.target;
        if (target === 'screen-map') {
          // Deactivate tabs
          navButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.backToMap();
        } else {
          // Placeholders for other tabs
          this.showComingSoonModal();
        }
      });
    });

    // Toggle Welcome Guide Panel
    const toggleWelcomeBtn = document.getElementById('btn-toggle-welcome');
    const welcomeGuideBody = document.getElementById('welcome-guide-body');
    if (toggleWelcomeBtn && welcomeGuideBody) {
      // Default to collapsed on mobile (< 650px) if not set yet
      if (window.innerWidth < 650 && localStorage.getItem('welcome_guide_collapsed') === null) {
        localStorage.setItem('welcome_guide_collapsed', 'true');
      }
      
      const welcomeCollapsed = localStorage.getItem('welcome_guide_collapsed') === 'true';
      if (welcomeCollapsed) {
        welcomeGuideBody.classList.add('collapsed');
        toggleWelcomeBtn.textContent = 'הצג הנחיות';
      } else {
        welcomeGuideBody.classList.remove('collapsed');
        toggleWelcomeBtn.textContent = 'הסתר הנחיות';
      }
      
      toggleWelcomeBtn.addEventListener('click', () => {
        const isCollapsed = welcomeGuideBody.classList.toggle('collapsed');
        toggleWelcomeBtn.textContent = isCollapsed ? 'הצג הנחיות' : 'הסתר הנחיות';
        localStorage.setItem('welcome_guide_collapsed', isCollapsed ? 'true' : 'false');
      });
    }
  }

  safeBind(id, event, callback) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener(event, callback);
    }
  }

  showView(viewName) {
    this.state.view = viewName;
    this.saveState();
    
    const views = {
      map: 'screen-map',
      game: 'screen-game',
      complete: 'screen-summary'
    };

    Object.keys(views).forEach(key => {
      const el = document.getElementById(views[key]);
      if (el) {
        if (key === viewName) {
          el.classList.remove('hidden');
          el.classList.add('active');
          el.style.display = (key === 'complete') ? 'flex' : 'block';
        } else {
          el.classList.add('hidden');
          el.classList.remove('active');
          el.style.display = 'none';
        }
      }
    });

    if (viewName === "map") {
      this.renderWorldMap();
    }
  }

  onWorldChange(e) {
    this.state.currentWorldId = e.target.value;
    this.saveState();
    this.renderWorldMap();
    this.renderMath(document.getElementById('screen-map'));
  }

  // ----------------------------------------------------
  // Top Bar Updates
  // ----------------------------------------------------
  updateTopBar() {
    this.setElementText('xp-display', `${this.state.xp} XP`);
    this.setElementText('stars-display', this.state.stars);
    this.setElementText('streak-display', this.state.streak);
  }

  setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
    }
  }

  // ----------------------------------------------------
  // World Map Renderer
  // ----------------------------------------------------
  renderWorldMap() {
    const nodesContainer = document.getElementById('dynamic-nodes-container');
    if (!nodesContainer) return;

    nodesContainer.innerHTML = '';
    
    const WORLDS = window.WORLDS || [];
    const world = WORLDS.find(w => w.id === this.state.currentWorldId);
    if (!world) return;

    // Render node coordinates sequentially
    // Level 0: 15% top, 15% right
    // Level 1: 45% top, 50% right
    // Level 2: 75% top, 80% right
    const coordinates = [
      { top: "15%", right: "15%" },
      { top: "45%", right: "50%" },
      { top: "75%", right: "80%" }
    ];

    // Determine lock/unlock states sequentially
    let isPrevLevelCompleted = true; // First level is unlocked
    let unlockedLevelsCount = 0;
    let completedLevelsCount = 0;

    // Track sequential index across the entire curriculum to unlock first level automatically
    let allCompletedKeys = Object.keys(this.state.completedLevels);

    world.levels.forEach((level, index) => {
      const isCompleted = !!this.state.completedLevels[level.id];
      if (isCompleted) completedLevelsCount++;

      // Level is unlocked if:
      // - It is the very first world's first level
      // - Or its previous level is completed
      // - Or for subsequent worlds: if the last level of the previous world was completed.
      // For simplicity, within the same world, check isPrevLevelCompleted.
      let isUnlocked = isPrevLevelCompleted;
      
      // If it is the first level of a world that is not the first world:
      // it is unlocked if the last level of the previous world was completed.
      if (index === 0) {
        const worldIndex = WORLDS.findIndex(w => w.id === world.id);
        if (worldIndex > 0) {
          const prevWorld = WORLDS[worldIndex - 1];
          const lastLevelOfPrevWorld = prevWorld.levels[prevWorld.levels.length - 1];
          isUnlocked = !!this.state.completedLevels[lastLevelOfPrevWorld.id];
        } else {
          isUnlocked = true; // first world, first level
        }
      }

      isPrevLevelCompleted = isCompleted;
      if (isUnlocked) unlockedLevelsCount++;

      const coords = coordinates[index % coordinates.length];

      // Create level node
      const nodeEl = document.createElement('div');
      nodeEl.className = `map-node ${isCompleted ? 'completed' : isUnlocked ? 'active' : 'locked'}`;
      nodeEl.style.top = coords.top;
      nodeEl.style.right = coords.right;
      nodeEl.dataset.levelId = level.id;
      nodeEl.dataset.worldId = world.id;

      // Inner icon HTML based on state
      let innerIcon = '<i data-lucide="lock" class="node-icon"></i>';
      if (isCompleted) {
        innerIcon = '<i data-lucide="check" class="node-icon"></i>';
      } else if (isUnlocked) {
        innerIcon = '<i data-lucide="play" class="node-icon fill-accent"></i>';
      }

      nodeEl.innerHTML = `
        ${isUnlocked && !isCompleted ? '<div class="node-glow-active"></div>' : '<div class="node-glow"></div>'}
        <div class="node-inner">
          ${innerIcon}
        </div>
        <div class="node-tooltip glass-card">
          <span class="level-tag">שלב ${index + 1} • ${world.name}</span>
          <h4 class="level-title">${level.name}</h4>
          <p class="level-desc">${level.description}</p>
          ${isCompleted ? `
            <span class="level-stat"><i data-lucide="award"></i> מושלם!</span>
          ` : isUnlocked ? `
            <button class="btn-primary start-level-btn w-full mt-2" data-level-id="${level.id}">שחק עכשיו</button>
          ` : `
            <span class="lock-reason"><i data-lucide="alert-circle"></i> נדרש להשלים שלבים קודמים</span>
          `}
        </div>
      `;

      nodesContainer.appendChild(nodeEl);

      // Node button click listener
      if (isUnlocked) {
        const btn = nodeEl.querySelector('.start-level-btn');
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startLevel(world.id, level.id);
          });
        } else {
          // Make the whole node clickable if there's no button
          nodeEl.addEventListener('click', () => {
            this.startLevel(world.id, level.id);
          });
        }
      }
    });

    // Sidebar Title
    const sidebarTitle = document.getElementById('sidebar-world-title');
    if (sidebarTitle) sidebarTitle.textContent = world.name;

    // Sidebar Objectives List
    const objectivesList = document.getElementById('sidebar-objectives-list');
    if (objectivesList) {
      objectivesList.innerHTML = '';
      world.levels.forEach((level, index) => {
        const isCompleted = !!this.state.completedLevels[level.id];
        let isUnlocked = (index === 0);
        if (index > 0) {
          isUnlocked = !!this.state.completedLevels[world.levels[index - 1].id];
        } else {
          const worldIndex = WORLDS.findIndex(w => w.id === world.id);
          if (worldIndex > 0) {
            const prevWorld = WORLDS[worldIndex - 1];
            const lastLvl = prevWorld.levels[prevWorld.levels.length - 1];
            isUnlocked = !!this.state.completedLevels[lastLvl.id];
          }
        }

        const li = document.createElement('li');
        li.className = isCompleted ? 'completed' : isUnlocked ? 'active' : 'locked';
        
        let iconHtml = '<i data-lucide="lock"></i>';
        if (isCompleted) {
          iconHtml = '<i data-lucide="check-circle2"></i>';
        } else if (isUnlocked) {
          iconHtml = '<i data-lucide="circle"></i>';
        }

        li.innerHTML = `
          ${iconHtml}
          <span>שלב ${index + 1}: ${level.name}</span>
        `;
        objectivesList.appendChild(li);
      });
    }

    // Sidebar World Progress
    const totalLevels = world.levels.length;
    const progressPercent = totalLevels > 0 ? Math.round((completedLevelsCount / totalLevels) * 100) : 0;
    
    const progressText = document.getElementById('sidebar-world-progress-text');
    if (progressText) progressText.textContent = `${progressPercent}%`;

    const progressFill = document.getElementById('sidebar-world-progress-fill');
    if (progressFill) progressFill.style.width = `${progressPercent}%`;

    // Medals Badge Count
    const medalsVal = document.getElementById('sidebar-medals');
    if (medalsVal) {
      medalsVal.innerHTML = `<i data-lucide="award" class="color-gold"></i> ${completedLevelsCount}/${totalLevels}`;
    }

    // Sidebar Average Accuracy
    const accuracyVal = document.getElementById('sidebar-accuracy');
    if (accuracyVal) {
      const avgAccuracy = this.state.totalAttempts > 0 
        ? Math.round((this.state.totalCorrect / this.state.totalAttempts) * 100) 
        : 100;
      accuracyVal.textContent = `${avgAccuracy}%`;
    }

    // Re-resolve Lucide icons in updated elements
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Render math formulas in updated elements on the map screen
    this.renderMath(document.getElementById('screen-map'));
  }

  // ----------------------------------------------------
  // Game Play Lifecycle
  // ----------------------------------------------------
  startLevel(worldId, levelId) {
    this.state.currentWorldId = worldId;
    this.state.currentLevelId = levelId;
    this.state.currentQuestionIndex = 0;
    this.saveState();

    // Reset gameplay trackers
    this.levelSeconds = 0;
    this.levelAttempts = 0;
    this.levelCorrect = 0;

    // Start timer interval
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.levelSeconds++;
      const timerVal = document.getElementById('time-counter');
      if (timerVal) {
        timerVal.textContent = this.formatTime(this.levelSeconds);
      }
    }, 1000);

    const timerVal = document.getElementById('time-counter');
    if (timerVal) {
      timerVal.textContent = this.formatTime(0);
    }

    this.showView("game");
    this.loadQuestion();
  }

  resumeLevel() {
    // If resuming, start timer from 0 or estimate
    this.startLevel(this.state.currentWorldId, this.state.currentLevelId);
  }

  getCurrentWorld() {
    const WORLDS = window.WORLDS || [];
    return WORLDS.find(w => w.id === this.state.currentWorldId);
  }

  getCurrentLevel() {
    const world = this.getCurrentWorld();
    return world ? world.levels.find(l => l.id === this.state.currentLevelId) : null;
  }

  loadQuestion() {
    const level = this.getCurrentLevel();
    if (!level) {
      this.backToMap();
      return;
    }

    const questionIndex = this.state.currentQuestionIndex;
    if (questionIndex >= level.questions.length) {
      // Level completed!
      this.completeLevel();
      return;
    }

    this.currentQuestion = level.questions[questionIndex];
    this.isAnswerChecked = false;
    this.hintsShown = 0;

    // Clear temp states
    this.selectedMatchingItem = null;
    this.matchingUserPairs = {};
    this.selectedDragItem = null;

    // Hide feedback panel
    const feedbackBox = document.getElementById('feedback-box');
    if (feedbackBox) {
      feedbackBox.style.display = 'none';
      feedbackBox.className = 'hidden';
      feedbackBox.innerHTML = '';
    } else {
      // Ensure feedback element exists dynamically if not in index.html
      this.createFeedbackBoxIfNeeded();
    }

    // Hide hint tooltip
    this.toggleHintTooltip(false);

    // Update screen titles and counters
    const levelTitle = document.querySelector('.game-level-title');
    if (levelTitle) {
      levelTitle.textContent = `שלב: ${level.name}`;
    }
    const progressText = document.querySelector('.game-progress-container .progress-text');
    if (progressText) {
      progressText.textContent = `שאלה ${questionIndex + 1} מתוך ${level.questions.length}`;
    }

    // Update progress fill bar
    const progressFill = document.querySelector('.game-progress-container .progress-fill');
    if (progressFill) {
      const percent = (questionIndex / level.questions.length) * 100;
      progressFill.style.width = `${percent}%`;
    }

    // Set Question Text
    const qText = document.querySelector('.question-text');
    if (qText) {
      qText.innerHTML = this.currentQuestion.question;
    }

    // Set Question Badge / Instruction
    const qBadge = document.querySelector('.question-badge');
    if (qBadge) {
      qBadge.textContent = this.currentQuestion.instruction || "משימה: גזירה וחקירה";
    }

    // Set Question Visual panel
    this.renderQuestionVisual(this.currentQuestion.id);

    // Render answer options
    this.renderAnswerArea();

    // Reset submit button text
    const submitBtn = document.getElementById('btn-submit-answer');
    if (submitBtn) {
      const btnSpan = submitBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = "בדיקת תשובה";
      submitBtn.classList.remove('btn-primary');
      submitBtn.classList.add('btn-check-answer');
    }

    // Typeset LaTeX equations
    this.renderMath(document.getElementById('screen-game'));
  }

  createFeedbackBoxIfNeeded() {
    const parentPanel = document.querySelector('.game-answer-panel');
    if (parentPanel) {
      let box = document.getElementById('feedback-box');
      if (!box) {
        box = document.createElement('div');
        box.id = 'feedback-box';
        box.style.display = 'none';
        box.className = 'hidden';
        // Insert before action footer
        const footer = document.querySelector('.game-action-footer');
        parentPanel.insertBefore(box, footer);
      }
    }
  }

  toggleHintTooltip(show) {
    const tooltip = document.getElementById('hint-tooltip');
    if (!tooltip) return;

    if (show) {
      this.renderHintsInTooltip();
      tooltip.classList.remove('hidden');
      // Force reflow
      tooltip.offsetHeight;
      tooltip.classList.add('active-drawer');
    } else {
      tooltip.classList.remove('active-drawer');
      // Wait for CSS transition (300ms) to complete before hiding
      setTimeout(() => {
        if (!tooltip.classList.contains('active-drawer')) {
          tooltip.classList.add('hidden');
        }
      }, 300);
    }
  }

  renderHintsInTooltip() {
    const tooltip = document.getElementById('hint-tooltip');
    if (!tooltip || !this.currentQuestion) return;

    // Dynamically update tooltip title to show current question instruction
    const titleSpan = tooltip.querySelector('.tooltip-title span');
    if (titleSpan) {
      titleSpan.textContent = this.currentQuestion.instruction || "רמז זהב";
    }

    const hints = this.currentQuestion.hints || [];
    const countToShow = Math.max(1, this.hintsShown); // Always show at least 1 hint when clicked

    const tooltipBody = tooltip.querySelector('.tooltip-body');
    if (tooltipBody) {
      let html = `<p class="mb-2"><strong>רמזים זמינים (${countToShow} מתוך ${hints.length}):</strong></p>`;
      html += `<ol class="list-decimal list-inside space-y-2 text-right">`;
      for (let i = 0; i < countToShow && i < hints.length; i++) {
        html += `<li class="hint-step">${hints[i]}</li>`;
      }
      html += `</ol>`;
      tooltipBody.innerHTML = html;
    }

    // Render math formulas inside the entire tooltip (including title if needed)
    this.renderMath(tooltip);
  }

  // ----------------------------------------------------
  // Question Visual Renderer
  // ----------------------------------------------------
  renderQuestionVisual(qId) {
    const wrapper = document.querySelector('.graphic-canvas-wrapper');
    if (!wrapper) return;

    let svgContent = '';

    // Check prefix or specific ID to render beautiful diagrams matching the Calculus curriculum
    if (qId.startsWith('w1_')) {
      // World 1: Root Derivatives
      if (qId === 'w1_l1_q1') {
        // f(x) = sqrt(2x-7), starts at x=3.5
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- f(x) = sqrt(2x-7) -->
              <path d="M 190,150 Q 270,95 380,75" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="190" cy="150" r="5" fill="var(--accent-cyan)" />
              <text x="180" y="170" fill="var(--text-white)" font-size="12" font-weight="bold">x = 3.5</text>
              <text x="280" y="80" fill="var(--accent-purple-light)" font-size="13" font-weight="bold">y = \u221A(2x-7)</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w1_l1_q2') {
        // f(x) = 5 + 4sqrt(x), starts at (0,5)
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- f(x) = 5 + 4sqrt(x) shifted up -->
              <path d="M 50,110 Q 180,60 350,45" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="50" cy="110" r="5" fill="var(--accent-cyan)" />
              <text x="35" y="125" fill="var(--text-white)" font-size="12" font-weight="bold">(0, 5)</text>
              <text x="220" y="50" fill="var(--accent-purple-light)" font-size="13" font-weight="bold">y = 5 + 4\u221Ax</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w1_l1_q3') {
        // f(x) = sqrt(x^2+9), point x=4
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- Hyperbolic look of sqrt(x^2+9) -->
              <path d="M 50,70 Q 200,165 350,70" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="290" cy="95" r="6" fill="var(--accent-success)" class="pulsing-dot" />
              <line x1="290" y1="95" x2="290" y2="150" stroke="rgba(255,255,255,0.2)" stroke-dasharray="3" />
              <line x1="290" y1="95" x2="50" y2="95" stroke="rgba(255,255,255,0.2)" stroke-dasharray="3" />
              <text x="300" y="90" fill="var(--accent-success-light)" font-size="12" font-weight="bold">P(4, 5)</text>
              <text x="160" y="145" fill="var(--accent-purple-light)" font-size="13">y = \u221A(x\u00B2+9)</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w1_l1_q4') {
        // f(x) = sqrt(10-2x), starts at x=5, goes left
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- root function going left -->
              <path d="M 230,150 Q 150,95 50,75" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="230" cy="150" r="5" fill="var(--accent-cyan)" />
              <text x="220" y="170" fill="var(--text-white)" font-size="12" font-weight="bold">x = 5</text>
              <text x="110" y="80" fill="var(--accent-purple-light)" font-size="13" font-weight="bold">y = \u221A(10-2x)</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w1_l2_q1' || qId === 'w1_l2_q4') {
        // x*sqrt(x+1) or (x-2)*sqrt(2x+2)
        const curveLabel = qId === 'w1_l2_q1' ? 'y = x\u221A(x+1)' : 'y = (x-2)\u221A(2x+2)';
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- starts negative, dips below x-axis, then rises -->
              <path d="M 100,150 Q 150,190 220,150 T 350,40" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="100" cy="150" r="5" fill="var(--accent-cyan)" />
              <text x="90" y="135" fill="var(--text-white)" font-size="11">נקודת התחלה</text>
              <text x="250" y="90" fill="var(--accent-purple-light)" font-size="13" font-weight="bold">${curveLabel}</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w1_l2_q2') {
        // x^2 * sqrt(4-x)
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- Starts at x=0 (50, 150), peaks at x=3.2 (250, 70), ends at x=4 (300, 150) -->
              <path d="M 50,150 C 100,140 200,40 250,70 T 300,150" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="250" cy="70" r="5" fill="var(--accent-cyan)" />
              <circle cx="300" cy="150" r="5" fill="var(--accent-error)" />
              <text x="230" y="55" fill="var(--accent-cyan-light)" font-size="11">קיצון פנימי</text>
              <text x="290" y="170" fill="var(--accent-error-light)" font-size="11">x = 4</text>
              <text x="130" y="90" fill="var(--accent-purple-light)" font-size="13" font-weight="bold">y = x\u00B2\u221A(4-x)</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w1_l2_q3') {
        // sqrt(x)/(x+1)
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- Starts at (0,0) [50, 150], rises to peak at x=1 [150, 90], decays slowly -->
              <path d="M 50,150 Q 100,60 180,100 T 380,135" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="50" cy="150" r="5" fill="var(--accent-cyan)" />
              <circle cx="120" cy="85" r="5" fill="var(--accent-success)" />
              <text x="110" y="70" fill="var(--accent-success-light)" font-size="11">מקסימום</text>
              <text x="200" y="80" fill="var(--accent-purple-light)" font-size="13" font-weight="bold">y = \u221Ax / (x+1)</text>
            </svg>
          </div>
        `;
      } else if (qId.startsWith('w1_l3_')) {
        // w1_l3_* - Tangent slopes
        let curveEq = '';
        let ptLabel = '';
        if (qId === 'w1_l3_q1') { curveEq = 'y = 5 + 4\u221Ax'; ptLabel = 'x = 4'; }
        else if (qId === 'w1_l3_q2') { curveEq = 'y = x\u221Ax'; ptLabel = 'x = 9'; }
        else { curveEq = 'y = 24/\u221Ax'; ptLabel = 'x = 4'; }

        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- Function Curve -->
              <path d="M 50,130 Q 180,80 350,60" fill="none" stroke="var(--accent-purple)" stroke-width="2.5" />
              <!-- Tangent Line -->
              <line x1="80" y1="120" x2="320" y2="60" stroke="var(--accent-cyan)" stroke-width="3" class="glowing-svg-line" />
              <!-- Tangency Point -->
              <circle cx="200" cy="90" r="6" fill="var(--accent-success)" class="pulsing-dot" />
              <text x="190" y="75" fill="var(--accent-success-light)" font-size="12" font-weight="bold">${ptLabel}</text>
              <text x="240" y="110" fill="var(--accent-purple-light)" font-size="12">${curveEq}</text>
              <text x="90" y="140" fill="var(--accent-cyan-light)" font-size="12">משיק: m = f'(${ptLabel.split(' = ')[1]})</text>
            </svg>
          </div>
        `;
      }
    } else if (qId.startsWith('w2_')) {
      // World 2: Tangents & Parameters
      if (qId.startsWith('w2_l1_')) {
        // Tangent equation
        let funcName = qId === 'w2_l1_q1' ? 'y = \u221A(2x+1)' : qId === 'w2_l1_q2' ? 'y = 4\u221Ax - x' : 'y = (x-3)\u221Ax';
        let ptX = qId === 'w2_l1_q1' ? 'x = 4' : qId === 'w2_l1_q2' ? 'x = 1' : 'x = 4';
        
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <path d="M 50,140 Q 180,90 350,70" fill="none" stroke="var(--accent-purple)" stroke-width="2.5" />
              <!-- Tangent Line -->
              <line x1="70" y1="130" x2="330" y2="70" stroke="var(--accent-cyan)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="200" cy="100" r="6" fill="var(--accent-success)" class="pulsing-dot" />
              <text x="190" y="85" fill="var(--accent-success-light)" font-size="12" font-weight="bold">${ptX}</text>
              <text x="240" y="120" fill="var(--accent-purple-light)" font-size="12">${funcName}</text>
              <text x="80" y="150" fill="var(--accent-cyan-light)" font-size="12">משוואת משיק: y - y\u2081 = m(x - x\u2081)</text>
            </svg>
          </div>
        `;
      } else if (qId.startsWith('w2_l2_')) {
        // Parameters finding
        let desc = qId === 'w2_l2_q1' ? 'f\'(-2) = 0.5 \u2192 a = ?' : qId === 'w2_l2_q2' ? 'f\'(1) = 0 \u2192 a = ?' : 'f(2) = 4 \u2192 a = ?';
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- Parameterized curve -->
              <path d="M 60,110 Q 180,90 320,130" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="180" cy="100" r="6" fill="var(--accent-cyan)" />
              <text x="160" y="80" fill="var(--text-white)" font-size="13" font-weight="bold">${desc}</text>
              <text x="80" y="140" fill="var(--accent-purple-light)" font-size="12">חקירת פרמטרים</text>
            </svg>
          </div>
        `;
      } else if (qId.startsWith('w2_l3_')) {
        // Geometric combination - Shaded areas!
        let shadedPoints = '';
        let lineD = '';
        let tangentText = '';
        
        if (qId === 'w2_l3_q1') {
          // Tangent: y = 0.25x + 1. Origin at (150, 150). X-int (-4,0) -> (50, 150). Y-int (0,1) -> (150, 110).
          shadedPoints = '150,150 50,150 150,110';
          lineD = 'x1="30" y1="158" x2="270" y2="62"';
          tangentText = 'y = 0.25x + 1';
        } else if (qId === 'w2_l3_q2') {
          // Tangent: y = -1/3x + 3. Origin at (100, 200). X-int (9,0) -> (280, 200). Y-int (0,3) -> (100, 110).
          shadedPoints = '100,200 100,110 280,200';
          lineD = 'x1="80" y1="100" x2="320" y2="220"';
          tangentText = 'y = -1/3x + 3';
        } else {
          // Tangent: y = 0.5x - 0.5. Origin at (150, 150). X-int (1,0) -> (190, 150). Y-int (0,-0.5) -> (150, 170).
          shadedPoints = '150,150 190,150 150,170';
          lineD = 'x1="110" y1="170" x2="270" y2="90"';
          tangentText = 'y = 0.5x - 0.5';
        }

        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- Shaded Triangle Area -->
              <polygon points="${shadedPoints}" fill="url(#area-gradient)" stroke="var(--accent-cyan)" stroke-width="1" style="opacity: 0.75;" />
              <!-- Tangent Line -->
              <line ${lineD} stroke="var(--accent-cyan)" stroke-width="3" class="glowing-svg-line" />
              <!-- Highlight labels -->
              <text x="210" y="70" fill="var(--accent-cyan-light)" font-size="11" font-weight="bold">${tangentText}</text>
              <text x="160" y="165" fill="var(--accent-success-light)" font-size="12" font-weight="bold">שטח המשולש S</text>
              <defs>
                <linearGradient id="area-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="rgba(6, 182, 212, 0.4)" />
                  <stop offset="100%" stop-color="rgba(168, 85, 247, 0.1)" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        `;
      }
    } else if (qId.startsWith('w3_')) {
      // World 3: Function Investigation
      if (qId === 'w3_l1_q1') {
        // Domain x <= 4
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- Shading the invalid region x > 4 -->
              <rect x="250" y="0" width="150" height="300" fill="rgba(239, 68, 68, 0.15)" />
              <line x1="250" y1="0" x2="250" y2="300" stroke="var(--accent-error)" stroke-width="2" stroke-dasharray="4" />
              <!-- curve starting at x=4 and going left -->
              <path d="M 250,150 Q 160,80 50,60" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <text x="260" y="40" fill="var(--accent-error-light)" font-size="11">תחום לא מוגדר (x > 4)</text>
              <text x="80" y="50" fill="var(--accent-success-light)" font-size="11">תחום הגדרה: x \u2264 4</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w3_l1_q3') {
        // Intersections
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <path d="M 50,150 Q 150,190 220,150 T 350,50" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="50" cy="150" r="6" fill="var(--accent-cyan)" class="pulsing-dot" />
              <circle cx="220" cy="150" r="6" fill="var(--accent-cyan)" class="pulsing-dot" />
              <text x="35" y="135" fill="var(--text-white)" font-size="12" font-weight="bold">(0,0)</text>
              <text x="210" y="135" fill="var(--text-white)" font-size="12" font-weight="bold">(3,0)</text>
              <text x="250" y="90" fill="var(--accent-purple-light)" font-size="12">חיתוך עם הצירים</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w3_l2_q1') {
        // Extrema of (x-3)sqrt(x)
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <path d="M 50,150 Q 150,210 220,150 T 350,50" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <!-- Local Min at x=1 -->
              <circle cx="110" cy="180" r="6" fill="var(--accent-success)" />
              <text x="120" y="195" fill="var(--accent-success-light)" font-size="11" font-weight="bold">מינימום מקומי (1, -2)</text>
              <!-- Boundary Max at x=0 -->
              <circle cx="50" cy="150" r="6" fill="var(--accent-cyan)" />
              <text x="20" y="135" fill="var(--accent-cyan-light)" font-size="11" font-weight="bold">מקסימום קצה (0,0)</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w3_l2_q2') {
        // Extrema of x^2*sqrt(5-x)
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <path d="M 50,150 Q 120,150 220,60 T 300,150" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <!-- Min (0,0) -->
              <circle cx="50" cy="150" r="6" fill="var(--accent-success)" />
              <text x="40" y="170" fill="var(--accent-success-light)" font-size="11" font-weight="bold">Min (0,0)</text>
              <!-- Max (4,16) -->
              <circle cx="220" cy="60" r="6" fill="var(--accent-cyan)" />
              <text x="200" y="45" fill="var(--accent-cyan-light)" font-size="11" font-weight="bold">Max (4,16)</text>
              <!-- Boundary (5,0) -->
              <circle cx="300" cy="150" r="6" fill="var(--accent-warning)" />
              <text x="290" y="170" fill="var(--accent-warning-light)" font-size="11" font-weight="bold">קצה (5,0)</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w3_l3_q1') {
        // y = sqrt(x) - 2 and y = k < -2
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <path d="M 50,190 Q 180,140 350,120" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="50" cy="190" r="5" fill="var(--accent-cyan)" />
              <text x="35" y="210" fill="var(--text-white)" font-size="11">y = -2</text>
              <!-- Horizontal line y = k -->
              <line x1="30" y1="230" x2="370" y2="230" stroke="var(--accent-error)" stroke-width="2.5" stroke-dasharray="3" />
              <text x="280" y="250" fill="var(--accent-error-light)" font-size="12" font-weight="bold">y = k (k < -2)</text>
              <text x="80" y="90" fill="var(--accent-purple-light)" font-size="12">אפס נקודות חיתוך!</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w3_l3_q2') {
        // x - 4sqrt(x) and y = -3
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <path d="M 50,130 Q 150,230 200,230 T 350,50" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <!-- Horizontal line y = -3 -->
              <line x1="30" y1="180" x2="370" y2="180" stroke="var(--accent-cyan)" stroke-width="2" />
              <circle cx="108" cy="180" r="5" fill="var(--accent-success)" class="pulsing-dot" />
              <circle cx="254" cy="180" r="5" fill="var(--accent-success)" class="pulsing-dot" />
              <text x="280" y="170" fill="var(--accent-cyan-light)" font-size="12" font-weight="bold">y = -3</text>
              <text x="80" y="70" fill="var(--accent-success-light)" font-size="12">שני פתרונות (שתי נקודות חיתוך)</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w3_l3_q3') {
        // sqrt(2x-x^2) and y = 1.5
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- Semicircle-like function, peak at y=1 -->
              <path d="M 100,150 A 80,80 0 0 1 260,150" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="180" cy="70" r="5" fill="var(--accent-cyan)" />
              <text x="170" y="55" fill="var(--accent-cyan-light)" font-size="11">מקסימום (1,1)</text>
              <!-- y = 1.5 line -->
              <line x1="50" y1="35" x2="310" y2="35" stroke="var(--accent-error)" stroke-width="2.5" stroke-dasharray="3" />
              <text x="240" y="25" fill="var(--accent-error-light)" font-size="12" font-weight="bold">y = 1.5</text>
              <text x="90" y="110" fill="var(--accent-purple-light)" font-size="12">אין חיתוך!</text>
            </svg>
          </div>
        `;
      }
    } else if (qId.startsWith('w4_')) {
      // World 4: Transformations & Derivatives
      if (qId === 'w4_l1_q1') {
        // f(x) = sqrt(x) shifted to g(x) = sqrt(x-3) + 4
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- Original f(x) -->
              <path d="M 50,150 Q 150,110 300,90" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" />
              <circle cx="50" cy="150" r="4" fill="gray" />
              <text x="35" y="170" fill="gray" font-size="10">f(x)=\u221Ax</text>
              
              <!-- Shifted g(x) -->
              <path d="M 140,90 Q 240,50 390,30" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <circle cx="140" cy="90" r="5" fill="var(--accent-cyan)" />
              <text x="130" y="75" fill="var(--accent-cyan-light)" font-size="11" font-weight="bold">g(x)</text>
              
              <!-- Shift vector arrow -->
              <path d="M 50,150 L 135,93" fill="none" stroke="var(--accent-success)" stroke-width="2" stroke-dasharray="3" marker-end="url(#arrow)" />
              <text x="80" y="115" fill="var(--accent-success-light)" font-size="11" font-weight="bold">\u05d4\u05d6\u05d6\u05d4: (+3, +4)</text>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-success)" />
                </marker>
              </defs>
            </svg>
          </div>
        `;
      } else if (qId === 'w4_l1_q2') {
        // f(x) shifted left by 3 and down by 5
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- Original f(x) Min at (4,-2) -> (170, 170) -->
              <circle cx="170" cy="170" r="5" fill="gray" />
              <text x="180" y="175" fill="gray" font-size="10">f(x) \u05e7\u05d9\u05e6\u05d5\u05df (4,-2)</text>
              
              <!-- Shifted g(x) Min at (1,-7) -> (80, 230) -->
              <circle cx="80" cy="230" r="6" fill="var(--accent-cyan)" class="pulsing-dot" />
              <text x="90" y="235" fill="var(--accent-cyan-light)" font-size="11" font-weight="bold">g(x) \u05e7\u05d9\u05e6\u05d5\u05df (1,-7)</text>
              
              <!-- Shift vector arrow -->
              <path d="M 170,170 L 85,225" fill="none" stroke="var(--accent-success)" stroke-width="2" stroke-dasharray="3" marker-end="url(#arrow)" />
              <text x="120" y="190" fill="var(--accent-success-light)" font-size="10" font-weight="bold">\u05d4\u05d6\u05d6\u05d4: (-3, -5)</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w4_l2_q1' || qId === 'w4_l2_q2') {
        // Connection between function behavior and derivative sign
        svgContent = `
          <div class="grid-coordinate-system" style="background: rgba(0,0,0,0.15);">
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- Split view: Upper is f(x), Lower is f'(x) -->
              <!-- Upper section f(x) -->
              <line x1="20" y1="120" x2="380" y2="120" stroke="rgba(255,255,255,0.15)" />
              <path d="M 40,110 Q 180,20 320,110" fill="none" stroke="var(--accent-purple)" stroke-width="2.5" />
              <text x="40" y="50" fill="var(--accent-purple-light)" font-size="11">גרף הפונקציה f(x)</text>
              
              <!-- Lower section f'(x) -->
              <line x1="20" y1="230" x2="380" y2="230" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
              <path d="M 40,180 L 320,280" fill="none" stroke="var(--accent-cyan)" stroke-width="2.5" class="glowing-svg-line" />
              <circle cx="180" cy="230" r="5" fill="var(--accent-warning)" />
              <text x="40" y="200" fill="var(--accent-cyan-light)" font-size="11">גרף הנגזרת f'(x)</text>
              
              <!-- Alignment line at x=3 or x=2 -->
              <line x1="180" y1="20" x2="180" y2="280" stroke="rgba(234, 179, 8, 0.3)" stroke-dasharray="3" />
              <text x="190" y="145" fill="var(--accent-warning-light)" font-size="10">\u05e7\u05d9\u05e6\u05d5\u05df \u2194 f'(x)=0</text>
            </svg>
          </div>
        `;
      } else if (qId === 'w4_l2_q3') {
        // f(x) = 2sqrt(x) - x, tangent slope = 0
        svgContent = `
          <div class="grid-coordinate-system">
            <div class="coord-grid-bg"></div>
            <div class="axis axis-x"></div>
            <div class="axis axis-y"></div>
            <span class="axis-label x-label">X</span>
            <span class="axis-label y-label">Y</span>
            <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
              <!-- peak at x=1 -->
              <path d="M 50,150 Q 150,70 350,130" fill="none" stroke="var(--accent-purple)" stroke-width="3" class="glowing-svg-line" />
              <!-- Horizontal tangent line at peak -->
              <line x1="80" y1="90" x2="220" y2="90" stroke="var(--accent-cyan)" stroke-width="2.5" stroke-dasharray="2" />
              <circle cx="150" cy="90" r="6" fill="var(--accent-success)" class="pulsing-dot" />
              <text x="140" y="75" fill="var(--accent-success-light)" font-size="12" font-weight="bold">x = 1 (f'(x) = 0)</text>
              <text x="230" y="120" fill="var(--accent-purple-light)" font-size="12">y = 2\u221Ax - x</text>
            </svg>
          </div>
        `;
      }
    }

    // Default fallback diagram if no custom match is found
    if (!svgContent) {
      svgContent = `
        <div class="grid-coordinate-system">
          <div class="coord-grid-bg"></div>
          <div class="axis axis-x"></div>
          <div class="axis axis-y"></div>
          <span class="axis-label x-label">X</span>
          <span class="axis-label y-label">Y</span>
          <svg class="graph-svg" viewBox="0 0 400 300" width="100%" height="100%">
            <!-- Simple placeholder line -->
            <line x1="50" y1="250" x2="350" y2="50" stroke="var(--accent-cyan)" stroke-dasharray="3" stroke-width="2" />
            <circle cx="200" cy="150" r="6" fill="var(--accent-purple)" class="pulsing-dot" />
            <text x="215" y="155" fill="var(--accent-purple-light)" font-size="12">\u05e2\u05d6\u05e8 \u05d7\u05d6\u05d5\u05ea\u05d9 \u05dc\u05e4\u05ea\u05e8\u05d5\u05df</text>
          </svg>
        </div>
      `;
    }

    wrapper.innerHTML = svgContent;
  }

  // ----------------------------------------------------
  // Dynamic Answer Area Rendering
  // ----------------------------------------------------
  renderAnswerArea() {
    const q = this.currentQuestion;

    // First hide all mode containers
    const containers = [
      'mode-multiple-choice',
      'mode-numeric-input',
      'mode-drag-drop', // templates matching
      'mode-steps-reorder' // templates reorder
    ];
    containers.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('hidden');
        el.classList.remove('active');
        el.style.display = 'none';
      }
    });

    // Handle matching containers if dynamically inserted
    const dynamicMatching = document.getElementById('mode-matching');
    if (dynamicMatching) {
      dynamicMatching.classList.add('hidden');
      dynamicMatching.style.display = 'none';
    }

    switch (q.type) {
      case 'numerical':
        this.renderNumericalArea();
        break;

      case 'multiple-choice':
        this.renderMultipleChoiceArea();
        break;

      case 'matching':
        this.renderMatchingArea();
        break;

      case 'drag-drop': // Steps reordering
        this.renderDragDropSortArea();
        break;

      case 'drag-drop-slots':
        this.renderDragDropSlotsArea();
        break;
    }
  }

  renderNumericalArea() {
    const container = document.getElementById('mode-numeric-input');
    if (!container) return;

    container.classList.remove('hidden');
    container.classList.add('active');
    container.style.display = 'flex';

    container.innerHTML = `
      <h3 class="answer-instruction">הקלד את התשובה המספרית המדויקת:</h3>
      <div class="input-form glass-card" style="padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 20px;">
        <div class="numerical-input-group" style="display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 24px;">
          <input type="number" step="any" id="numerical-answer" class="math-input" placeholder="הקלד מספר..." style="width: 240px;" autocomplete="off">
        </div>
        <div class="math-keypad" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: 100%; max-width: 320px;">
          <button class="keypad-btn" data-char="-">-</button>
          <button class="keypad-btn" data-char=".">.</button>
          <button class="keypad-btn" data-char="0">0</button>
          <button class="keypad-btn" id="keypad-clear" style="background: rgba(239, 68, 68, 0.1); color: var(--accent-error-light); border-color: rgba(239,68,68,0.2);">נקה</button>
        </div>
      </div>
    `;

    // Keypad functionality
    const input = document.getElementById('numerical-answer');
    const keypadButtons = container.querySelectorAll('.keypad-btn:not(#keypad-clear)');
    keypadButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isAnswerChecked) return;
        const char = btn.dataset.char;
        input.value += char;
      });
    });

    const clearBtn = document.getElementById('keypad-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (this.isAnswerChecked) return;
        input.value = '';
      });
    }
  }

  renderMultipleChoiceArea() {
    const container = document.getElementById('mode-multiple-choice');
    if (!container) return;

    container.classList.remove('hidden');
    container.classList.add('active');
    container.style.display = 'flex';

    let choicesHtml = '';
    this.currentQuestion.options.forEach((opt, idx) => {
      choicesHtml += `
        <button class="choice-card glass-card" data-index="${idx}" style="width: 100%;">
          <span class="choice-shortcut">${idx + 1}</span>
          <span class="choice-math">${opt}</span>
          <span class="feedback-indicator"></span>
        </button>
      `;
    });

    container.innerHTML = `
      <h3 class="answer-instruction">בחר את האפשרות הנכונה:</h3>
      <div class="choices-grid">
        ${choicesHtml}
      </div>
    `;

    // Add click listeners to choices
    const choices = container.querySelectorAll('.choice-card');
    choices.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isAnswerChecked) return;
        if (btn.classList.contains('incorrect')) return; // Ignore click if already incorrect

        // Reset all selections
        choices.forEach(c => {
          c.classList.remove('selected');
          c.style.borderColor = '';
          c.style.boxShadow = '';
        });

        // Set active selection
        btn.classList.add('selected');
        btn.style.borderColor = 'var(--accent-purple)';
        btn.style.boxShadow = '0 0 10px var(--accent-purple-glow)';
      });
    });
  }

  renderMatchingArea() {
    // We don't have matching template in index.html, so we insert it dynamically inside game-answer-panel
    const answerPanel = document.querySelector('.game-answer-panel');
    if (!answerPanel) return;

    let container = document.getElementById('mode-matching');
    if (!container) {
      container = document.createElement('div');
      container.id = 'mode-matching';
      container.className = 'answer-container';
      // Insert before the footer
      const footer = document.querySelector('.game-action-footer');
      answerPanel.insertBefore(container, footer);
    }

    container.classList.remove('hidden');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';

    const q = this.currentQuestion;

    // Shuffle left items and right items separately
    const lefts = q.pairs.map(p => p.left);
    const rights = q.pairs.map(p => p.right);
    this.shuffleArray(lefts);
    this.shuffleArray(rights);

    let leftsHtml = '';
    lefts.forEach(val => {
      leftsHtml += `
        <div class="matching-left-item glass-card" data-val="${val.replace(/"/g, '&quot;')}" style="padding: 12px; text-align: center; font-weight: bold; cursor: pointer; border: 1px solid var(--border-glass);">
          ${val}
        </div>
      `;
    });

    let rightsHtml = '';
    rights.forEach(val => {
      rightsHtml += `
        <div class="matching-right-item glass-card" data-val="${val.replace(/"/g, '&quot;')}" style="padding: 12px; text-align: center; font-weight: bold; cursor: pointer; border: 1px solid var(--border-glass);">
          ${val}
        </div>
      `;
    });

    container.innerHTML = `
      <h3 class="answer-instruction">התאם בין הפריטים (לחץ על פריט מימין ולאחר מכן על הפריט המתאים לו משמאל):</h3>
      <div class="matching-layout" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="matching-left-column" style="display: flex; flex-direction: column; gap: 12px;">
          <h4 class="text-xs font-bold text-neon-cyan text-center mb-1">פונקציה / ביטוי</h4>
          ${leftsHtml}
        </div>
        <div class="matching-right-column" style="display: flex; flex-direction: column; gap: 12px;">
          <h4 class="text-xs font-bold text-neon-magenta text-center mb-1">פתרון / נגזרת</h4>
          ${rightsHtml}
        </div>
      </div>
      <div id="matching-summary" style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid var(--border-glass); display: none;">
        <h4 class="text-sm font-bold text-gray-400 mb-2">זיווגים שנוצרו:</h4>
        <div id="matching-pairs" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>
      </div>
    `;

    this.initMatchingListeners(container);
  }

  initMatchingListeners(container) {
    const leftItems = container.querySelectorAll('.matching-left-item');
    const rightItems = container.querySelectorAll('.matching-right-item');
    const summary = container.querySelector('#matching-summary');
    const pairsDiv = container.querySelector('#matching-pairs');

    const colors = [
      'rgba(6, 182, 212, 0.25)', // Cyan
      'rgba(168, 85, 247, 0.25)', // Purple
      'rgba(34, 197, 94, 0.25)', // Green
      'rgba(234, 179, 8, 0.25)' // Yellow
    ];

    const borderColors = [
      'var(--accent-cyan)',
      'var(--accent-purple)',
      'var(--accent-success)',
      'var(--accent-warning)'
    ];

    const updateMatchingUI = () => {
      // Clear highlight styles
      leftItems.forEach(el => {
        el.style.background = '';
        el.style.borderColor = '';
        el.style.boxShadow = '';
      });
      rightItems.forEach(el => {
        el.style.background = '';
        el.style.borderColor = '';
        el.style.boxShadow = '';
      });

      // Highlight selected left item
      if (this.selectedMatchingItem) {
        const selectedEl = Array.from(leftItems).find(el => el.dataset.val === this.selectedMatchingItem);
        if (selectedEl) {
          selectedEl.style.borderColor = 'var(--text-white)';
          selectedEl.style.boxShadow = '0 0 10px rgba(255,255,255,0.4)';
        }
      }

      // Highlight established pairs
      Object.entries(this.matchingUserPairs).forEach(([leftVal, rightVal], idx) => {
        const colorIdx = idx % colors.length;
        const leftEl = Array.from(leftItems).find(el => el.dataset.val === leftVal);
        const rightEl = Array.from(rightItems).find(el => el.dataset.val === rightVal);

        if (leftEl) {
          leftEl.style.background = colors[colorIdx];
          leftEl.style.borderColor = borderColors[colorIdx];
        }
        if (rightEl) {
          rightEl.style.background = colors[colorIdx];
          rightEl.style.borderColor = borderColors[colorIdx];
        }
      });

      // Update Summary Chips
      const pairsCount = Object.keys(this.matchingUserPairs).length;
      if (pairsCount > 0) {
        summary.style.display = 'block';
        pairsDiv.innerHTML = '';
        Object.entries(this.matchingUserPairs).forEach(([leftVal, rightVal]) => {
          const chip = document.createElement('div');
          chip.className = 'glass-card';
          chip.style.padding = '6px 12px';
          chip.style.fontSize = '12px';
          chip.style.display = 'flex';
          chip.style.alignItems = 'center';
          chip.style.gap = '8px';
          chip.style.borderRadius = '20px';
          chip.innerHTML = `
            <span style="color: var(--accent-cyan-light);">${leftVal}</span>
            <span style="opacity: 0.5;">↔</span>
            <span style="color: var(--accent-purple-light);">${rightVal}</span>
            <button class="delete-chip-btn" style="color: var(--accent-error); background: transparent; border: none; font-weight: bold; cursor: pointer;">✕</button>
          `;

          chip.querySelector('.delete-chip-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isAnswerChecked) return;
            delete this.matchingUserPairs[leftVal];
            updateMatchingUI();
          });

          pairsDiv.appendChild(chip);
        });
        this.renderMath(pairsDiv);
      } else {
        summary.style.display = 'none';
      }
    };

    leftItems.forEach(el => {
      el.addEventListener('click', () => {
        if (this.isAnswerChecked) return;
        const val = el.dataset.val;

        // If click on already paired, delete pair
        if (this.matchingUserPairs[val]) {
          delete this.matchingUserPairs[val];
          updateMatchingUI();
          return;
        }

        this.selectedMatchingItem = val;
        updateMatchingUI();
      });
    });

    rightItems.forEach(el => {
      el.addEventListener('click', () => {
        if (this.isAnswerChecked) return;
        const val = el.dataset.val;

        if (this.selectedMatchingItem) {
          // Check if right item is already paired, if so delete previous pair
          Object.keys(this.matchingUserPairs).forEach(leftKey => {
            if (this.matchingUserPairs[leftKey] === val) {
              delete this.matchingUserPairs[leftKey];
            }
          });

          // Establish new pair
          this.matchingUserPairs[this.selectedMatchingItem] = val;
          this.selectedMatchingItem = null;
          updateMatchingUI();
        } else {
          alert("אנא בחר קודם כל פריט מהעמודה הימנית!");
        }
      });
    });
  }

  renderDragDropSortArea() {
    const container = document.getElementById('mode-steps-reorder');
    if (!container) return;

    container.classList.remove('hidden');
    container.classList.add('active');
    container.style.display = 'flex';

    const q = this.currentQuestion;

    // Shuffle items while keeping track of their original indices
    const itemsWithIndex = q.items.map((item, idx) => ({ text: item, originalIndex: idx }));
    this.shuffleArray(itemsWithIndex);

    const hebrewLetters = ["א", "ב", "ג", "ד", "ה", "ו", "ז"];

    let itemsHtml = '';
    itemsWithIndex.forEach((item, idx) => {
      itemsHtml += `
        <div class="reorder-item glass-card" draggable="true" data-original-index="${item.originalIndex}" style="display: flex; align-items: center; gap: 16px; padding: 12px 16px; margin-bottom: 8px;">
          <div class="reorder-handle" style="opacity: 0.3; cursor: grab;"><i data-lucide="grip-vertical"></i></div>
          <span class="step-num" style="color: var(--accent-cyan-light); font-weight: bold;">${hebrewLetters[idx]}.</span>
          <span class="step-content" style="flex-grow: 1; text-align: right;">${item.text}</span>
          <div class="reorder-controls" style="display: flex; gap: 8px;">
            <button class="reorder-up" style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-size: 11px;">▲</button>
            <button class="reorder-down" style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-size: 11px;">▼</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <h3 class="answer-instruction">סדר את שלבי הפתרון של המשוואה לפי הסדר הלוגי הנכון (גרור ושחרר או השתמש בחצים):</h3>
      <div class="reorder-list" id="sortable-steps-container" style="display: flex; flex-direction: column;">
        ${itemsHtml}
      </div>
    `;

    // Initialize drag & drop and button controls
    this.initDragDropSortListeners(container.querySelector('#sortable-steps-container'));
  }

  initDragDropSortListeners(listContainer) {
    let draggedItem = null;

    listContainer.addEventListener('dragstart', (e) => {
      if (this.isAnswerChecked) {
        e.preventDefault();
        return;
      }
      const item = e.target.closest('.reorder-item');
      if (item) {
        draggedItem = item;
        item.style.opacity = '0.4';
      }
    });

    listContainer.addEventListener('dragend', (e) => {
      const item = e.target.closest('.reorder-item');
      if (item) {
        item.style.opacity = '1';
      }
      draggedItem = null;
    });

    listContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      const item = e.target.closest('.reorder-item');
      if (item && draggedItem && item !== draggedItem) {
        const rect = item.getBoundingClientRect();
        const after = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        listContainer.insertBefore(draggedItem, after ? item.nextSibling : item);
      }
    });

    // Up / Down buttons
    const items = listContainer.querySelectorAll('.reorder-item');
    items.forEach(item => {
      const upBtn = item.querySelector('.reorder-up');
      const downBtn = item.querySelector('.reorder-down');

      upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isAnswerChecked) return;
        const prev = item.previousElementSibling;
        if (prev) {
          listContainer.insertBefore(item, prev);
        }
      });

      downBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isAnswerChecked) return;
        const next = item.nextElementSibling;
        if (next) {
          listContainer.insertBefore(next, item);
        }
      });
    });
  }

  renderDragDropSlotsArea() {
    const container = document.getElementById('mode-drag-drop');
    if (!container) return;

    container.classList.remove('hidden');
    container.classList.add('active');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    const q = this.currentQuestion;

    // Render slots
    let slotsHtml = '';
    q.slots.forEach(slot => {
      slotsHtml += `
        <div class="matching-row" style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; margin-bottom: 12px;">
          <div class="drop-slot glass-card" data-slot-id="${slot.id}" style="min-height: 52px; border: 2px dashed rgba(255,255,255,0.15); display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; justify-content: center; align-items: center; border-radius: var(--radius-md); background: rgba(0,0,0,0.15);">
            <span class="placeholder-text" style="color: var(--text-muted); font-size: 11px;">גרור לכאן פריטים מתאימים</span>
          </div>
          <div class="slot-label-card" style="width: 200px; text-align: right; background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); padding: 12px 16px; border-radius: var(--radius-md); font-size: 14px; font-weight: bold;">
            ${slot.label}
          </div>
        </div>
      `;
    });

    // Render items bank
    const bankItems = [...q.items];
    this.shuffleArray(bankItems);

    let bankHtml = '';
    bankItems.forEach(item => {
      bankHtml += `
        <div class="drag-item glass-card" draggable="true" data-item-id="${item.id}" style="padding: 8px 12px; cursor: grab; font-size: 13px; font-weight: bold; border-radius: var(--radius-sm); border: 1px solid var(--border-glass);">
          ${item.text}
        </div>
      `;
    });

    container.innerHTML = `
      <h3 class="answer-instruction" style="margin-bottom: 8px;">מיין את הפריטים למשבצות המתאימות (בגרירה או בלחיצה):</h3>
      <div class="matching-layout" style="display: grid; grid-template-columns: 160px 1fr; gap: 20px; flex: 1;">
        <div class="drag-items-column" id="items-bank" style="display: flex; flex-direction: column; gap: 10px; border: 1px dashed rgba(255,255,255,0.15); padding: 12px; border-radius: var(--radius-md); background: rgba(0,0,0,0.1); min-height: 120px;">
          ${bankHtml}
        </div>
        <div class="drop-slots-column" style="display: flex; flex-direction: column;">
          ${slotsHtml}
        </div>
      </div>
    `;

    this.initDragDropSlotsListeners(container);
  }

  initDragDropSlotsListeners(container) {
    const bank = container.querySelector('#items-bank');
    const slots = container.querySelectorAll('.drop-slot');
    const items = container.querySelectorAll('.drag-item');

    let draggedItem = null;

    // Draggable items
    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        if (this.isAnswerChecked) {
          e.preventDefault();
          return;
        }
        draggedItem = item;
        item.style.opacity = '0.5';
      });

      item.addEventListener('dragend', () => {
        item.style.opacity = '1';
        draggedItem = null;
      });

      // Mobile Click-to-Move
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isAnswerChecked) return;

        // If inside a slot, return to bank on click
        if (item.parentNode.classList.contains('drop-slot')) {
          const slot = item.parentNode;
          bank.appendChild(item);
          
          // Re-add placeholder if slot is empty
          if (slot.querySelectorAll('.drag-item').length === 0) {
            const placeholder = slot.querySelector('.placeholder-text');
            if (placeholder) placeholder.style.display = 'block';
          }
          
          this.selectedDragItem = null;
          this.clearDragItemHighlights(container);
          return;
        }

        // Select for slot placement
        this.clearDragItemHighlights(container);
        this.selectedDragItem = item;
        item.style.borderColor = 'var(--text-white)';
        item.style.boxShadow = '0 0 10px rgba(255,255,255,0.4)';
      });
    });

    // Slots drop areas
    slots.forEach(slot => {
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        slot.style.borderColor = 'var(--accent-purple)';
        slot.style.background = 'var(--accent-purple-glow)';
      });

      slot.addEventListener('dragleave', () => {
        slot.style.borderColor = 'rgba(255,255,255,0.15)';
        slot.style.background = 'rgba(0,0,0,0.15)';
      });

      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.style.borderColor = 'rgba(255,255,255,0.15)';
        slot.style.background = 'rgba(0,0,0,0.15)';
        if (draggedItem) {
          const placeholder = slot.querySelector('.placeholder-text');
          if (placeholder) placeholder.style.display = 'none';
          
          slot.appendChild(draggedItem);
        }
      });

      // Click to move to slot
      slot.addEventListener('click', () => {
        if (this.isAnswerChecked) return;
        if (this.selectedDragItem) {
          const placeholder = slot.querySelector('.placeholder-text');
          if (placeholder) placeholder.style.display = 'none';
          
          slot.appendChild(this.selectedDragItem);
          this.clearDragItemHighlights(container);
          this.selectedDragItem = null;
        }
      });
    });

    // Bank drop area
    bank.addEventListener('dragover', (e) => {
      e.preventDefault();
      bank.style.background = 'rgba(0,0,0,0.2)';
    });

    bank.addEventListener('dragleave', () => {
      bank.style.background = 'rgba(0,0,0,0.1)';
    });

    bank.addEventListener('drop', (e) => {
      e.preventDefault();
      bank.style.background = 'rgba(0,0,0,0.1)';
      if (draggedItem) {
        // Show slot placeholder if empty
        const oldSlot = draggedItem.parentNode;
        bank.appendChild(draggedItem);
        
        if (oldSlot && oldSlot.classList.contains('drop-slot') && oldSlot.querySelectorAll('.drag-item').length === 0) {
          const placeholder = oldSlot.querySelector('.placeholder-text');
          if (placeholder) placeholder.style.display = 'block';
        }
      }
    });

    // Click bank to return item
    bank.addEventListener('click', () => {
      if (this.isAnswerChecked) return;
      if (this.selectedDragItem) {
        const oldSlot = this.selectedDragItem.parentNode;
        bank.appendChild(this.selectedDragItem);
        
        if (oldSlot && oldSlot.classList.contains('drop-slot') && oldSlot.querySelectorAll('.drag-item').length === 0) {
          const placeholder = oldSlot.querySelector('.placeholder-text');
          if (placeholder) placeholder.style.display = 'block';
        }

        this.clearDragItemHighlights(container);
        this.selectedDragItem = null;
      }
    });
  }

  clearDragItemHighlights(container) {
    container.querySelectorAll('.drag-item').forEach(item => {
      item.style.borderColor = '';
      item.style.boxShadow = '';
    });
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // ----------------------------------------------------
  // Answer Validation
  // ----------------------------------------------------
  submitAnswer() {
    // If answer is already checked and correct, button behaves as "Continue"
    const submitBtn = document.getElementById('btn-submit-answer');
    if (submitBtn) {
      const btnSpan = submitBtn.querySelector('span');
      if (btnSpan && (btnSpan.textContent === "המשך" || btnSpan.textContent === "לשאלה הבאה")) {
        this.nextQuestion();
        return;
      }
    }

    if (this.isAnswerChecked) return;

    const q = this.currentQuestion;
    let isCorrect = false;

    // Validate based on question type
    if (q.type === 'numerical') {
      const input = document.getElementById('numerical-answer');
      if (!input || input.value.trim() === '') {
        alert("נא להזין תשובה מספרית!");
        return;
      }
      const userVal = parseFloat(input.value.trim());
      const correctVal = parseFloat(q.answer);
      const tolerance = 0.01;
      isCorrect = !isNaN(userVal) && Math.abs(userVal - correctVal) <= tolerance;

    } else if (q.type === 'multiple-choice') {
      const selected = document.querySelector('.choice-card.selected');
      if (!selected) {
        alert("נא לבחור באחת האפשרויות!");
        return;
      }
      const selectedIdx = parseInt(selected.dataset.index);
      isCorrect = selectedIdx === q.answer;

      if (isCorrect) {
        selected.classList.add('correct');
      } else {
        selected.classList.add('incorrect');
        selected.classList.remove('selected');
        selected.style.borderColor = '';
        selected.style.boxShadow = '';
      }

    } else if (q.type === 'matching') {
      const pairsCount = Object.keys(this.matchingUserPairs).length;
      if (pairsCount < q.pairs.length) {
        alert("נא להתאים את כל הזוגות לפני הבדיקה!");
        return;
      }

      isCorrect = true;
      for (let i = 0; i < q.pairs.length; i++) {
        const correctPair = q.pairs[i];
        if (this.matchingUserPairs[correctPair.left] !== correctPair.right) {
          isCorrect = false;
          break;
        }
      }

    } else if (q.type === 'drag-drop') {
      const items = Array.from(document.querySelectorAll('#sortable-steps-container .reorder-item'));
      const userOrder = items.map(el => parseInt(el.dataset.originalIndex));
      isCorrect = JSON.stringify(userOrder) === JSON.stringify(q.correctOrder);

    } else if (q.type === 'drag-drop-slots') {
      const slots = document.querySelectorAll('.drop-slot');
      const userSlots = {};
      
      let totalPlaced = 0;
      slots.forEach(slot => {
        const slotId = slot.dataset.slotId;
        const itemIds = Array.from(slot.querySelectorAll('.drag-item')).map(el => el.dataset.itemId);
        userSlots[slotId] = itemIds;
        totalPlaced += itemIds.length;
      });

      if (totalPlaced < q.items.length) {
        alert("נא למקם את כל הפריטים במשבצות!");
        return;
      }

      isCorrect = true;
      for (const slotId in q.answer) {
        const correctItems = q.answer[slotId];
        const userItems = userSlots[slotId] || [];

        // Check if items match (order independent)
        const match = (correctItems.length === userItems.length) &&
                      [...correctItems].sort().toString() === [...userItems].sort().toString();
        if (!match) {
          isCorrect = false;
          break;
        }
      }
    }

    // Process attempts
    this.levelAttempts++;
    this.state.totalAttempts++;

    if (isCorrect) {
      this.levelCorrect++;
      this.state.totalCorrect++;
      this.handleCorrectAnswer();
    } else {
      this.handleIncorrectAnswer();
    }

    this.saveState();
  }

  handleCorrectAnswer() {
    this.isAnswerChecked = true;
    const xpGained = 15;
    this.state.xp += xpGained;
    
    // Sound and custom effects
    if (window.playSuccessSound) window.playSuccessSound();
    if (window.triggerDigitalFractalsConfetti) window.triggerDigitalFractalsConfetti();

    // Streak update
    this.updateStreak();
    this.updateTopBar();

    // Feedback panel
    const feedbackBox = document.getElementById('feedback-box');
    if (feedbackBox) {
      feedbackBox.style.display = 'block';
      feedbackBox.className = 'p-4 rounded-lg text-center font-bold mb-4 glass-card';
      feedbackBox.style.borderColor = 'var(--accent-success)';
      feedbackBox.style.background = 'rgba(34, 197, 94, 0.1)';
      feedbackBox.innerHTML = `
        <div class="text-xl" style="color: var(--accent-success-light);">🎉 מצוין! תשובה נכונה!</div>
        <div class="text-sm font-normal mt-1 text-gray-300">נוספו +${xpGained} XP למאזנך.</div>
      `;
    }

    // Update check button to say Continue
    const submitBtn = document.getElementById('btn-submit-answer');
    if (submitBtn) {
      const btnSpan = submitBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = "המשך";
      submitBtn.classList.remove('btn-check-answer');
      submitBtn.classList.add('btn-primary');
    }

    // Disable answer elements
    this.disableAnswerInputs();
    this.checkAndUnlockBadges();
  }

  handleIncorrectAnswer() {
    this.hintsShown++;

    // Shake visual display card
    const visualsPanel = document.querySelector('.game-visuals-panel');
    if (visualsPanel) {
      visualsPanel.style.animation = 'wiggle 0.5s ease';
      setTimeout(() => {
        visualsPanel.style.animation = '';
      }, 500);
    }

    // Feedback panel
    const feedbackBox = document.getElementById('feedback-box');
    if (feedbackBox) {
      feedbackBox.style.display = 'block';
      feedbackBox.className = 'p-4 rounded-lg text-center font-bold mb-4 glass-card';
      feedbackBox.style.borderColor = 'var(--accent-error)';
      feedbackBox.style.background = 'rgba(239, 68, 68, 0.1)';
      feedbackBox.innerHTML = `
        <div class="text-xl" style="color: var(--accent-error-light);">❌ תשובה לא מדויקת, נסה שוב.</div>
        <div class="text-xs font-normal mt-1 text-gray-300">התווסף רמז חדש בתיבת הטיפים למטה!</div>
      `;
    }

    // Auto display hints in tooltip step-by-step
    this.toggleHintTooltip(true);
  }

  disableAnswerInputs() {
    const inputs = document.querySelectorAll('#screen-game input, #screen-game button:not(#btn-submit-answer):not(#btn-exit-game):not(#btn-show-hint):not(#btn-close-hint)');
    inputs.forEach(el => {
      el.disabled = true;
    });

    const dragItems = document.querySelectorAll('#screen-game [draggable="true"]');
    dragItems.forEach(el => {
      el.setAttribute('draggable', 'false');
      el.style.cursor = 'default';
    });
  }

  // ----------------------------------------------------
  // Streak Logic
  // ----------------------------------------------------
  updateStreak() {
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (this.state.lastPlayedDate) {
      const lastDate = new Date(this.state.lastPlayedDate);
      const today = new Date(todayStr);
      const diffTime = Math.abs(today - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        this.state.streak += 1;
      } else if (diffDays > 1) {
        this.state.streak = 1;
      }
    } else {
      this.state.streak = 1;
    }
    
    this.state.lastPlayedDate = todayStr;
  }

  // ----------------------------------------------------
  // Level Completion Logic
  // ----------------------------------------------------
  completeLevel() {
    if (this.timerId) clearInterval(this.timerId);

    const level = this.getCurrentLevel();
    const isFirstTime = !this.state.completedLevels[level.id];
    
    let bonusXP = 50;
    let starGained = 1;

    if (isFirstTime) {
      this.state.completedLevels[level.id] = true;
      this.state.xp += bonusXP;
      this.state.stars += starGained;
    } else {
      bonusXP = 15;
      starGained = 0;
      this.state.xp += bonusXP;
    }

    this.saveState();
    this.updateTopBar();

    // Trigger visual confetti and sound effects
    if (window.playSuccessSound) window.playSuccessSound();
    if (window.triggerDigitalFractalsConfetti) window.triggerDigitalFractalsConfetti();

    // Fill Stats Grid in Summary Overlay
    const summary = document.getElementById('screen-summary');
    if (summary) {
      const title = summary.querySelector('.victory-title');
      if (title) title.textContent = `השלמת את ${level.name}!`;

      const subtitle = summary.querySelector('.victory-subtitle');
      if (subtitle) {
        subtitle.textContent = isFirstTime 
          ? "כל הכבוד! עברת את השלב בהצלחה ופתחת את המפת הרמה הבאה!" 
          : "עבודה מצוינת! אימון חוזר מוביל לשלמות!";
      }

      // XP Reward
      const xpVal = summary.querySelector('.summary-stats-grid .stat-card:nth-child(1) .stat-main span');
      if (xpVal) xpVal.textContent = `+${bonusXP} XP`;

      // Time
      const timeVal = summary.querySelector('.summary-stats-grid .stat-card:nth-child(2) .stat-main span');
      if (timeVal) timeVal.textContent = this.formatTime(this.levelSeconds);

      // Level Accuracy
      const accuracyPercent = this.levelAttempts > 0 
        ? Math.round((this.levelCorrect / this.levelAttempts) * 100) 
        : 100;
      const accuracyVal = summary.querySelector('.summary-stats-grid .stat-card:nth-child(3) .stat-main span');
      if (accuracyVal) accuracyVal.textContent = `${accuracyPercent}%`;

      // Streak
      const streakVal = summary.querySelector('.summary-stats-grid .stat-card:nth-child(4) .stat-main span');
      if (streakVal) streakVal.textContent = `${this.state.streak} ימים`;
    }

    // Toggle Badge Card visibility in completion summary
    const badgeCard = document.querySelector('.unlocked-badge-card');
    if (badgeCard) {
      badgeCard.style.display = 'none'; // hide by default unless unlocked during this level
    }

    this.showView("complete");
    this.checkAndUnlockBadges();
  }

  // ----------------------------------------------------
  // Badges Management
  // ----------------------------------------------------
  checkAndUnlockBadges() {
    const unlockedNow = [];
    const WORLDS = window.WORLDS || [];

    // 1. 🌱 First steps (XP > 0)
    if (this.state.xp > 0 && !this.state.badges.includes('first_steps')) {
      unlockedNow.push('first_steps');
    }

    // 2. 🧪 World 1 Master
    const w1 = WORLDS.find(w => w.id === 'world_1');
    if (w1) {
      const allW1Completed = w1.levels.every(lvl => this.state.completedLevels[lvl.id]);
      if (allW1Completed && !this.state.badges.includes('world_1_master')) {
        unlockedNow.push('world_1_master');
      }
    }

    // 3. 📐 World 2 Master
    const w2 = WORLDS.find(w => w.id === 'world_2');
    if (w2) {
      const allW2Completed = w2.levels.every(lvl => this.state.completedLevels[lvl.id]);
      if (allW2Completed && !this.state.badges.includes('world_2_master')) {
        unlockedNow.push('world_2_master');
      }
    }

    // 4. 📊 World 3 Master
    const w3 = WORLDS.find(w => w.id === 'world_3');
    if (w3) {
      const allW3Completed = w3.levels.every(lvl => this.state.completedLevels[lvl.id]);
      if (allW3Completed && !this.state.badges.includes('world_3_master')) {
        unlockedNow.push('world_3_master');
      }
    }

    // 5. 📈 World 4 Master
    const w4 = WORLDS.find(w => w.id === 'world_4');
    if (w4) {
      const allW4Completed = w4.levels.every(lvl => this.state.completedLevels[lvl.id]);
      if (allW4Completed && !this.state.badges.includes('world_4_master')) {
        unlockedNow.push('world_4_master');
      }
    }

    // 6. 🔥 Streak 3
    if (this.state.streak >= 3 && !this.state.badges.includes('streak_3')) {
      unlockedNow.push('streak_3');
    }

    // 7. 🎖️ XP 100
    if (this.state.xp >= 100 && !this.state.badges.includes('xp_100')) {
      unlockedNow.push('xp_100');
    }

    // 8. 👑 XP 500
    if (this.state.xp >= 500 && !this.state.badges.includes('xp_500')) {
      unlockedNow.push('xp_500');
    }

    if (unlockedNow.length > 0) {
      unlockedNow.forEach(badgeId => {
        this.state.badges.push(badgeId);
        this.showBadgeModal(BADGES[badgeId]);
      });
      this.saveState();
      this.updateTopBar();
    }
  }

  showBadgeModal(badge) {
    // If inside level complete summary screen, update the achievements card
    const badgeCard = document.querySelector('.unlocked-badge-card');
    if (badgeCard && this.state.view === 'complete') {
      badgeCard.style.display = 'flex';
      const bTitle = badgeCard.querySelector('h5');
      const bDesc = badgeCard.querySelector('p');
      if (bTitle) bTitle.textContent = `תג נפתח: ${badge.name} ${badge.icon}`;
      if (bDesc) bDesc.textContent = badge.desc;
      return;
    }

    // Otherwise show general modal popup dynamically
    let modal = document.getElementById('dynamic-badge-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dynamic-badge-modal';
      modal.className = 'summary-overlay';
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100vw';
      modal.style.height = '100vh';
      modal.style.background = 'rgba(10, 5, 20, 0.9)';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.zIndex = '10000';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="summary-modal glass-card" style="max-width: 400px; text-align: center; padding: 30px; display: flex; flex-direction: column; align-items: center; gap: 20px;">
        <div style="font-size: 64px; animation: bounce 1.5s infinite;">${badge.icon}</div>
        <h2 class="victory-title" style="font-size: 24px; color: var(--accent-purple-light);">תג חדש נפתח!</h2>
        <h3 style="font-size: 18px; font-weight: bold;">${badge.name}</h3>
        <p style="color: var(--text-muted); font-size: 14px;">${badge.desc}</p>
        <button class="btn-primary w-full" id="btn-close-badge-modal">מגניב!</button>
      </div>
    `;

    modal.style.display = 'flex';
    if (window.playSuccessSound) window.playSuccessSound();

    const closeBtn = modal.querySelector('#btn-close-badge-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
  }

  // ----------------------------------------------------
  // LaTeX Formula Renderer (KaTeX / MathJax Integration)
  // ----------------------------------------------------
  renderMath(element) {
    if (!element) return;
    
    // 1. Attempt KaTeX Auto-Render
    if (typeof renderMathInElement === 'function') {
      try {
        renderMathInElement(element, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
        return;
      } catch (err) {
        console.warn("KaTeX rendering failed, trying MathJax:", err);
      }
    }

    // 2. Fallback to MathJax
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([element]).catch((err) => {
        console.error("MathJax typeset failed:", err);
      });
    }
  }

  // ----------------------------------------------------
  // Navigation
  // ----------------------------------------------------
  nextQuestion() {
    this.state.currentQuestionIndex++;
    this.saveState();
    this.loadQuestion();
  }

  backToMap() {
    if (this.timerId) clearInterval(this.timerId);
    this.showView("map");
  }

  showExitWarningModal() {
    const modal = document.getElementById('modal-exit-warning');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  hideExitWarningModal() {
    const modal = document.getElementById('modal-exit-warning');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  showComingSoonModal() {
    const modal = document.getElementById('modal-coming-soon');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  hideComingSoonModal() {
    const modal = document.getElementById('modal-coming-soon');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  quickPlay() {
    const WORLDS = window.WORLDS || [];
    const world = WORLDS.find(w => w.id === this.state.currentWorldId);
    if (!world) return;

    // Find the first level of the current world that is not completed
    const activeLevel = world.levels.find(level => !this.state.completedLevels[level.id]);
    
    if (activeLevel) {
      this.startLevel(this.state.currentWorldId, activeLevel.id);
    } else {
      // If all levels are completed, start from the first level
      this.startLevel(this.state.currentWorldId, world.levels[0].id);
    }
  }

  formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}

// ----------------------------------------------------
// App Initialization
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  window.gameController = new GameController();
  window.gameController.init();
});
