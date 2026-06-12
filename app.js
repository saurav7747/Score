// app.js

class SauravScore {
  constructor() {
    this.currentMatch = null;
    this.matchHistory = [];
    this.deferredPrompt = null;
    this.init();
  }

  init() {
    this.bindElements();
    this.loadHistory();
    this.handleSplash();
    this.registerSW();
    this.listenInstall();
    window.addEventListener('online', () => this.updateOnlineStatus());
    window.addEventListener('offline', () => this.updateOnlineStatus());
    this.updateOnlineStatus();
  }

  bindElements() {
    this.screens = {
      dashboard: document.getElementById('dashboardScreen'),
      create: document.getElementById('createMatchScreen'),
      scoreboard: document.getElementById('scoreboardScreen'),
      history: document.getElementById('historyScreen')
    };
    this.splash = document.getElementById('splashScreen');
    this.installBanner = document.getElementById('installBanner');
    this.installBtn = document.getElementById('installBtn');
    this.offlineIndicator = document.getElementById('offlineIndicator');
  }

  handleSplash() {
    setTimeout(() => {
      this.splash.style.opacity = '0';
      setTimeout(() => {
        this.splash.style.display = 'none';
      }, 300);
    }, 400);
  }

  navigateTo(screenId) {
    Object.values(this.screens).forEach(s => s.classList.remove('active'));
    this.screens[screenId].classList.add('active');
  }

  // ----- Navigation Events (delegated) -----
  setupEvents() {
    document.getElementById('newMatchBtn').onclick = () => this.navigateTo('create');
    document.getElementById('historyBtn').onclick = () => { this.renderHistory(); this.navigateTo('history'); };
    document.getElementById('backFromCreate').onclick = () => this.navigateTo('dashboard');
    document.getElementById('backFromHistory').onclick = () => this.navigateTo('dashboard');
    document.getElementById('backToDashboard').onclick = () => this.confirmBackToDashboard();
    document.getElementById('startMatchBtn').onclick = () => this.createMatch();
    document.getElementById('undoBtn').onclick = () => this.undoBall();
    document.getElementById('endOverBtn').onclick = () => this.endOver();
    document.getElementById('endInningsBtn').onclick = () => this.endInnings();
    document.getElementById('resetMatchBtn').onclick = () => this.resetMatch();
    document.getElementById('exportBtn').onclick = () => this.exportJSON();
    if (this.installBtn) this.installBtn.onclick = () => this.installApp();
  }

  confirmBackToDashboard() {
    if (this.currentMatch && !this.currentMatch.isCompleted) {
      if (confirm('Match in progress. Go back to dashboard?')) {
        this.autoSave();
        this.navigateTo('dashboard');
      }
    } else {
      this.navigateTo('dashboard');
    }
  }

  // ----- Match Engine -----
  createMatch() {
    const teamA = document.getElementById('teamA').value.trim() || 'Team A';
    const teamB = document.getElementById('teamB').value.trim() || 'Team B';
    const overs = parseInt(document.getElementById('oversInput').value) || 20;
    const toss = document.getElementById('tossWinner').value;
    const decision = document.getElementById('decision').value;

    const battingFirst = (toss === 'A' && decision === 'bat') || (toss === 'B' && decision === 'bowl') ? 'A' : 'B';
    const bowlingFirst = battingFirst === 'A' ? 'B' : 'A';

    this.currentMatch = {
      id: Date.now(),
      teamA, teamB,
      totalOvers: overs,
      innings: [],
      currentInnings: 0,
      battingTeam: battingFirst,
      bowlingTeam: bowlingFirst,
      isCompleted: false,
      result: null,
      undoStack: [],
      createdAt: new Date().toISOString()
    };

    this.initInnings(0);
    this.navigateTo('scoreboard');
    this.renderScoreboard();
  }

  initInnings(inningsIndex) {
    const inn = {
      battingTeam: this.currentMatch.battingTeam,
      bowlingTeam: this.currentMatch.bowlingTeam,
      runs: 0,
      wickets: 0,
      balls: 0,
      overs: 0,
      ballHistory: [],
      batsmen: [{ name: 'Batsman 1', runs: 0, balls: 0, fours: 0, sixes: 0, striker: true },
                { name: 'Batsman 2', runs: 0, balls: 0, fours: 0, sixes: 0, striker: false }],
      bowlers: [{ name: 'Bowler 1', overs: 0, runs: 0, wickets: 0 }],
      currentBowlerIndex: 0,
      target: null
    };
    if (inningsIndex === 1 && this.currentMatch.innings[0]) {
      inn.target = this.currentMatch.innings[0].runs + 1;
    }
    this.currentMatch.innings[inningsIndex] = inn;
    this.currentMatch.currentInnings = inningsIndex;
  }

  getCurrentInnings() {
    return this.currentMatch.innings[this.currentMatch.currentInnings];
  }

  recordBall(run, type = 'normal') {
    if (!this.currentMatch || this.currentMatch.isCompleted) return;
    const inn = this.getCurrentInnings();
    if (inn.wickets >= 10 || inn.overs >= this.currentMatch.totalOvers) return;

    this.currentMatch.undoStack.push(JSON.parse(JSON.stringify(inn)));

    let runsToAdd = run;
    let isWicket = (type === 'wicket');
    let isWide = (type === 'wide');
    let isNoBall = (type === 'noball');
    let legalBall = true;

    if (isWide) {
      runsToAdd = 1 + (run || 0);
      legalBall = false;
    } else if (isNoBall) {
      runsToAdd = 1 + (run || 0);
      legalBall = false;
    }

    inn.runs += runsToAdd;
    if (legalBall) inn.balls++;
    inn.overs = Math.floor(inn.balls / 6) + (inn.balls % 6) / 10;

    const striker = inn.batsmen.find(b => b.striker);
    if (striker) {
      striker.runs += runsToAdd;
      if (!isWide && !isNoBall) striker.balls++;
      if (run === 4) striker.fours++;
      if (run === 6) striker.sixes++;
    }

    if (isWicket) {
      inn.wickets++;
      if (striker) striker.striker = false;
      if (inn.wickets < 10) {
        const newBatsman = { name: `Batsman ${inn.wickets+1}`, runs: 0, balls: 0, fours: 0, sixes: 0, striker: true };
        inn.batsmen.push(newBatsman);
        if (inn.batsmen.length > 1) inn.batsmen[inn.batsmen.length-2].striker = false;
      }
    }

    const bowler = inn.bowlers[inn.currentBowlerIndex];
    if (bowler) {
      if (legalBall) bowler.overs = (bowler.overs || 0) + 0.1;
      bowler.runs += runsToAdd;
      if (isWicket) bowler.wickets++;
    }

    inn.ballHistory.push({ ball: inn.overs.toFixed(1), run, type });

    if (!isWicket && run % 2 !== 0 && legalBall) this.rotateStrike();
    if (run === 4 || run === 6) { /* no rotation */ }
    if (legalBall && (inn.balls % 6 === 0)) this.rotateStrike();

    if (inn.wickets >= 10 || inn.overs >= this.currentMatch.totalOvers) {
      this.checkInningsEnd();
    }

    this.renderScoreboard();
    this.autoSave();
  }

  rotateStrike() {
    const inn = this.getCurrentInnings();
    inn.batsmen.forEach(b => b.striker = !b.striker);
  }

  endOver() {
    const inn = this.getCurrentInnings();
    const remaining = (inn.balls % 6);
    if (remaining > 0) {
      inn.balls += (6 - remaining);
      inn.overs = Math.ceil(inn.overs);
    }
    this.rotateStrike();
    this.renderScoreboard();
    this.autoSave();
  }

  undoBall() {
    if (!this.currentMatch || !this.currentMatch.undoStack.length) return;
    const inn = this.getCurrentInnings();
    const prev = this.currentMatch.undoStack.pop();
    Object.assign(inn, prev);
    this.renderScoreboard();
    this.autoSave();
  }

  checkInningsEnd() {
    const inn = this.getCurrentInnings();
    if (this.currentMatch.currentInnings === 0) {
      this.currentMatch.battingTeam = this.currentMatch.bowlingTeam;
      this.currentMatch.bowlingTeam = inn.battingTeam;
      this.initInnings(1);
    } else {
      this.calculateResult();
      this.currentMatch.isCompleted = true;
    }
    this.renderScoreboard();
  }

  endInnings() {
    if (!this.currentMatch || this.currentMatch.isCompleted) return;
    this.checkInningsEnd();
  }

  calculateResult() {
    const inn1 = this.currentMatch.innings[0];
    const inn2 = this.currentMatch.innings[1];
    if (!inn1 || !inn2) return;
    const team1 = inn1.battingTeam;
    const team2 = inn2.battingTeam;
    if (inn2.runs >= inn1.runs + 1) {
      this.currentMatch.result = `${team2} won by ${10 - inn2.wickets} wickets`;
    } else {
      this.currentMatch.result = `${team1} won by ${inn1.runs - inn2.runs} runs`;
    }
  }

  resetMatch() {
    if (confirm('Reset current match?')) {
      this.currentMatch = null;
      this.navigateTo('dashboard');
    }
  }

  // ----- Rendering -----
  renderScoreboard() {
    if (!this.currentMatch) return;
    const inn = this.getCurrentInnings();
    const card = document.getElementById('liveScoreCard');
    const targetText = inn.target ? `Target ${inn.target}` : '';
    card.innerHTML = `
      <div class="team-name-big">${inn.battingTeam}</div>
      <div class="score-display">
        <span class="team-score">${inn.runs} / ${inn.wickets}</span>
        <span class="overs-text">${inn.overs.toFixed(1)} Overs</span>
      </div>
      <div class="crr-target">
        <span>CRR ${inn.overs > 0 ? (inn.runs / inn.overs).toFixed(2) : '0.00'}</span>
        ${targetText ? `<span>${targetText}</span>` : ''}
      </div>
      ${this.currentMatch.isCompleted ? `<div style="margin-top:12px; font-weight:600;">${this.currentMatch.result || ''}</div>` : ''}
    `;

    this.renderBatsmen();
    this.renderBowlers();
    this.renderScoringPanel();
    this.renderBallHistory();
  }

  renderBatsmen() {
    const inn = this.getCurrentInnings();
    const container = document.getElementById('batsmanContainer');
    container.innerHTML = '<div style="font-weight:600; margin-bottom:8px;">Batsmen</div>';
    inn.batsmen.forEach(b => {
      const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : '0';
      container.innerHTML += `<div class="batsman-row ${b.striker ? 'striker-indicator' : ''}">
        <span>${b.name} ${b.striker ? '●' : ''}</span>
        <span>${b.runs}(${b.balls}) 4s:${b.fours} 6s:${b.sixes} SR:${sr}</span>
      </div>`;
    });
  }

  renderBowlers() {
    const inn = this.getCurrentInnings();
    const container = document.getElementById('bowlerContainer');
    container.innerHTML = '<div style="font-weight:600; margin-bottom:8px;">Bowlers</div>';
    inn.bowlers.forEach((b, idx) => {
      const eco = b.overs > 0 ? (b.runs / b.overs).toFixed(2) : '0.00';
      container.innerHTML += `<div class="bowler-row">
        <span>${b.name} ${idx === inn.currentBowlerIndex ? '●' : ''}</span>
        <span>${b.overs.toFixed(1)}-${b.runs}-${b.wickets} Eco:${eco}</span>
      </div>`;
    });
  }

  renderScoringPanel() {
    const panel = document.getElementById('scoringPanel');
    panel.innerHTML = '';
    const runs = [0,1,2,3,4,6];
    runs.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'scoring-btn';
      btn.textContent = r;
      btn.onclick = () => this.recordBall(r);
      panel.appendChild(btn);
    });
    const extras = [
      { text: 'W', cls: 'wicket', action: ()=> this.recordBall(0, 'wicket') },
      { text: 'WD', cls: 'wide', action: ()=> this.recordBall(0, 'wide') },
      { text: 'NB', cls: '', action: ()=> this.recordBall(0, 'noball') }
    ];
    extras.forEach(e => {
      const btn = document.createElement('button');
      btn.className = `scoring-btn ${e.cls}`;
      btn.textContent = e.text;
      btn.onclick = e.action;
      panel.appendChild(btn);
    });
  }

  renderBallHistory() {
    const inn = this.getCurrentInnings();
    const hist = document.getElementById('ballHistory');
    hist.innerHTML = inn.ballHistory.slice().reverse().map(b => 
      `<span style="margin-right:8px;">${b.ball} ${b.type==='wicket'?'W':b.type==='wide'?'WD':b.type==='noball'?'NB':b.run}</span>`
    ).join('') || 'No balls yet';
  }

  // ----- History & Storage -----
  autoSave() {
    if (!this.currentMatch) return;
    const matches = JSON.parse(localStorage.getItem('sauravscore_matches') || '[]');
    const idx = matches.findIndex(m => m.id === this.currentMatch.id);
    if (idx > -1) matches[idx] = this.currentMatch;
    else matches.push(this.currentMatch);
    localStorage.setItem('sauravscore_matches', JSON.stringify(matches));
    this.matchHistory = matches;
  }

  loadHistory() {
    this.matchHistory = JSON.parse(localStorage.getItem('sauravscore_matches') || '[]');
  }

  renderHistory() {
    const container = document.getElementById('historyList');
    if (!this.matchHistory.length) {
      container.innerHTML = '<div class="empty-state">No matches yet</div>';
      return;
    }
    container.innerHTML = this.matchHistory.slice().reverse().map(m => `
      <div class="history-item" data-id="${m.id}">
        <div style="font-weight:500;">${m.teamA} vs ${m.teamB}</div>
        <div style="font-size:0.85rem; color:#6B7280;">${m.result || 'In Progress'} · ${new Date(m.createdAt).toLocaleDateString()}</div>
      </div>
    `).join('');
    container.querySelectorAll('.history-item').forEach(el => {
      el.onclick = () => this.openMatch(parseInt(el.dataset.id));
    });
  }

  openMatch(id) {
    const match = this.matchHistory.find(m => m.id === id);
    if (match) {
      this.currentMatch = match;
      this.navigateTo('scoreboard');
      this.renderScoreboard();
    }
  }

  exportJSON() {
    if (!this.currentMatch) return;
    const data = JSON.stringify(this.currentMatch, null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `match-${this.currentMatch.id}.json`; a.click();
  }

  // ----- PWA & Offline -----
  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js');
    }
  }

  listenInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.installBanner.style.display = 'flex';
    });
    window.addEventListener('appinstalled', () => {
      this.installBanner.style.display = 'none';
      this.deferredPrompt = null;
    });
  }

  installApp() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then(() => {
        this.deferredPrompt = null;
        this.installBanner.style.display = 'none';
      });
    }
  }

  updateOnlineStatus() {
    if (!navigator.onLine) {
      this.offlineIndicator.style.display = 'block';
    } else {
      this.offlineIndicator.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new SauravScore();
  app.setupEvents();
});
