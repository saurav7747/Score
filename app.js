// app.js
let currentMatch = null;
let matchHistory = [];

// Load from localStorage
function loadHistory() {
    const saved = localStorage.getItem('sauravscore_history');
    if (saved) {
        matchHistory = JSON.parse(saved);
    }
}

function saveHistory() {
    localStorage.setItem('sauravscore_history', JSON.stringify(matchHistory));
}

// Splash Screen
function initSplash() {
    const splash = document.getElementById('splash');
    const mainApp = document.getElementById('main-app');
    
    setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.classList.add('hidden');
            mainApp.classList.remove('hidden');
            navigateTo('dashboard');
        }, 600);
    }, 400);
}

// Navigation
function navigateTo(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    
    if (screen === 'dashboard') {
        document.getElementById('dashboard-screen').classList.remove('hidden');
    } else if (screen === 'new-match') {
        document.getElementById('new-match-screen').classList.remove('hidden');
        setupNewMatchForm();
    } else if (screen === 'live-match') {
        document.getElementById('live-match-screen').classList.remove('hidden');
    } else if (screen === 'history') {
        document.getElementById('history-screen').classList.remove('hidden');
        renderHistory();
    }
}

// New Match Form
function setupNewMatchForm() {
    const form = document.getElementById('new-match-form');
    const teamAInput = document.getElementById('teamA');
    const teamBInput = document.getElementById('teamB');
    const tossSelect = document.getElementById('toss-winner');
    
    form.onsubmit = (e) => {
        e.preventDefault();
        
        const teamA = teamAInput.value.trim();
        const teamB = teamBInput.value.trim();
        const overs = parseInt(document.getElementById('overs').value);
        const tossWinner = tossSelect.value;
        const decision = document.querySelector('input[name="decision"]:checked').value;
        
        if (!teamA || !teamB || !tossWinner) {
            alert("Please fill all fields");
            return;
        }
        
        currentMatch = {
            id: Date.now(),
            teamA: teamA,
            teamB: teamB,
            totalOvers: overs,
            tossWinner: tossWinner,
            battingFirst: (tossWinner === teamA && decision === 'bat') || (tossWinner === teamB && decision === 'bowl'),
            innings: 1,
            battingTeam: null,
            bowlingTeam: null,
            score: 0,
            wickets: 0,
            balls: 0,
            currentOver: 0,
            batsmen: [
                { name: "Batsman 1", runs: 0, balls: 0, fours: 0, sixes: 0 },
                { name: "Batsman 2", runs: 0, balls: 0, fours: 0, sixes: 0 }
            ],
            currentBatsmanIndex: 0,
            bowler: { name: "Bowler 1", overs: 0, runs: 0, wickets: 0, balls: 0 },
            ballHistory: [],
            completed: false,
            date: new Date().toISOString()
        };
        
        // Set batting team
        currentMatch.battingTeam = currentMatch.battingFirst ? teamA : teamB;
        currentMatch.bowlingTeam = currentMatch.battingFirst ? teamB : teamA;
        
        renderLiveMatch();
        navigateTo('live-match');
    };
    
    // Populate toss dropdown
    tossSelect.innerHTML = `<option value="">Select Team</option>`;
    tossSelect.innerHTML += `<option value="\( {teamAInput.value || 'Team A'}"> \){teamAInput.value || 'Team A'}</option>`;
    tossSelect.innerHTML += `<option value="\( {teamBInput.value || 'Team B'}"> \){teamBInput.value || 'Team B'}</option>`;
}

// Live Match Rendering
function renderLiveMatch() {
    if (!currentMatch) return;
    
    // Header
    document.getElementById('teams-display').textContent = 
        `${currentMatch.battingTeam} vs ${currentMatch.bowlingTeam}`;
    
    // Scoreboard
    document.getElementById('batting-team-name').textContent = currentMatch.battingTeam;
    document.getElementById('total-runs').textContent = currentMatch.score;
    document.getElementById('total-wickets').textContent = currentMatch.wickets;
    
    const oversBowled = Math.floor(currentMatch.balls / 6) + (currentMatch.balls % 6) / 10;
    document.getElementById('current-over').textContent = oversBowled.toFixed(1);
    
    const crr = currentMatch.balls > 0 ? (currentMatch.score / (currentMatch.balls / 6)).toFixed(2) : "0.00";
    document.getElementById('current-rr').textContent = crr;
    
    // Batsmen
    const batsmenHTML = currentMatch.batsmen.map((batsman, index) => `
        <div class="player-card ${index === currentMatch.currentBatsmanIndex ? 'active' : ''}">
            <div class="player-name">${batsman.name} ${index === currentMatch.currentBatsmanIndex ? '⭐' : ''}</div>
            <div class="player-stats">
                <div>\( {batsman.runs} ( \){batsman.balls})</div>
                <div>${batsman.fours}4s ${batsman.sixes}6s</div>
                <div>SR: ${batsman.balls > 0 ? ((batsman.runs / batsman.balls) * 100).toFixed(0) : 0}</div>
            </div>
        </div>
    `).join('');
    document.getElementById('batsmen-list').innerHTML = batsmenHTML;
    
    // Bowler
    const bowler = currentMatch.bowler;
    const economy = bowler.balls > 0 ? (bowler.runs / (bowler.balls / 6)).toFixed(2) : "0.00";
    const bowlerHTML = `
        <div class="player-card">
            <div class="player-name">${bowler.name}</div>
            <div class="player-stats">
                <div>\( {bowler.overs}. \){bowler.balls % 6} overs</div>
                <div>${bowler.runs} runs</div>
                <div>${bowler.wickets} wkts</div>
                <div>Econ: ${economy}</div>
            </div>
        </div>
    `;
    document.getElementById('current-bowler').innerHTML = bowlerHTML;
    
    // Ball History
    renderBallHistory();
}

function renderBallHistory() {
    const container = document.getElementById('ball-history');
    container.innerHTML = currentMatch.ballHistory.slice(-12).map(entry => `
        <div class="ball-entry">${entry}</div>
    `).join('');
}

// Scoring
function addScore(runs) {
    if (!currentMatch || currentMatch.wickets >= 10) return;
    
    currentMatch.score += runs;
    currentMatch.balls++;
    
    // Update current batsman
    const batsman = currentMatch.batsmen[currentMatch.currentBatsmanIndex];
    batsman.runs += runs;
    batsman.balls++;
    
    if (runs === 4) batsman.fours++;
    if (runs === 6) batsman.sixes++;
    
    // Record history
    const over = Math.floor(currentMatch.balls / 6);
    const ballInOver = (currentMatch.balls % 6) || 6;
    currentMatch.ballHistory.push(`\( {over}. \){ballInOver} ${runs}`);
    
    // Rotate strike on odd runs
    if (runs % 2 === 1) {
        currentMatch.currentBatsmanIndex = 1 - currentMatch.currentBatsmanIndex;
    }
    
    // Update bowler
    currentMatch.bowler.runs += runs;
    currentMatch.bowler.balls++;
    
    checkOverComplete();
    renderLiveMatch();
    checkMatchEnd();
}

function addWicket() {
    if (!currentMatch || currentMatch.wickets >= 10) return;
    
    currentMatch.wickets++;
    currentMatch.balls++;
    
    const batsman = currentMatch.batsmen[currentMatch.currentBatsmanIndex];
    batsman.balls++; // faced the ball
    
    // Record
    const over = Math.floor(currentMatch.balls / 6);
    const ballInOver = (currentMatch.balls % 6) || 6;
    currentMatch.ballHistory.push(`\( {over}. \){ballInOver} W`);
    
    currentMatch.bowler.wickets++;
    currentMatch.bowler.balls++;
    
    // Switch batsman
    currentMatch.currentBatsmanIndex = 1 - currentMatch.currentBatsmanIndex;
    
    checkOverComplete();
    renderLiveMatch();
    checkMatchEnd();
}

function addExtra(type) {
    if (!currentMatch) return;
    
    currentMatch.score += (type === 'WD' || type === 'NB') ? 1 : 0;
    
    const over = Math.floor(currentMatch.balls / 6);
    const ballInOver = (currentMatch.balls % 6) || 6;
    currentMatch.ballHistory.push(`\( {over}. \){ballInOver} ${type}`);
    
    currentMatch.bowler.runs += 1;
    
    renderLiveMatch();
}

function checkOverComplete() {
    if (currentMatch.balls % 6 === 0 && currentMatch.balls > 0) {
        // End of over - rotate strike
        currentMatch.currentBatsmanIndex = 1 - currentMatch.currentBatsmanIndex;
        // TODO: change bowler in full version
    }
}

function checkMatchEnd() {
    const oversCompleted = Math.floor(currentMatch.balls / 6);
    
    if (currentMatch.wickets >= 10 || oversCompleted >= currentMatch.totalOvers) {
        finishMatch();
    }
}

function finishMatch() {
    currentMatch.completed = true;
    
    matchHistory.unshift({
        ...currentMatch,
        result: `${currentMatch.battingTeam} won by ${10 - currentMatch.wickets} wickets`
    });
    
    saveHistory();
    
    // Show result modal
    showResultModal();
}

function showResultModal() {
    const modal = document.getElementById('result-modal');
    document.getElementById('modal-winner').innerHTML = `
        ${currentMatch.battingTeam} <span style="color:#22C55E">WON</span>
    `;
    document.getElementById('modal-margin').textContent = `by ${10 - currentMatch.wickets} wickets`;
    
    document.getElementById('modal-teamA').innerHTML = `
        <strong>${currentMatch.teamA}</strong><br>
        ${currentMatch.battingTeam === currentMatch.teamA ? currentMatch.score : '—'} / ${currentMatch.wickets}
    `;
    
    document.getElementById('modal-teamB').innerHTML = `
        <strong>${currentMatch.teamB}</strong><br>
        ${currentMatch.battingTeam === currentMatch.teamB ? currentMatch.score : '—'} / ${currentMatch.wickets}
    `;
    
    modal.classList.remove('hidden');
}

function closeModalAndGoHome() {
    document.getElementById('result-modal').classList.add('hidden');
    navigateTo('dashboard');
    currentMatch = null;
}

function endMatchConfirm() {
    if (confirm("End current match?")) {
        finishMatch();
    }
}

// Next Batsman
function showNextBatsmanModal() {
    document.getElementById('next-batsman-modal').classList.remove('hidden');
    document.getElementById('new-batsman-name').focus();
}

function hideNextBatsmanModal() {
    document.getElementById('next-batsman-modal').classList.add('hidden');
}

function addNewBatsman() {
    const name = document.getElementById('new-batsman-name').value.trim();
    if (!name) return;
    
    currentMatch.batsmen[currentMatch.currentBatsmanIndex] = {
        name: name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0
    };
    
    hideNextBatsmanModal();
    renderLiveMatch();
}

// Undo
function undoLastBall() {
    if (!currentMatch || currentMatch.ballHistory.length === 0) return;
    
    currentMatch.ballHistory.pop();
    
    // Simplified undo - just revert last scoring action
    if (currentMatch.score > 0) {
        currentMatch.score = Math.max(0, currentMatch.score - 1);
        currentMatch.balls = Math.max(0, currentMatch.balls - 1);
    }
    
    renderLiveMatch();
}

// History
function renderHistory() {
    const container = document.getElementById('history-list');
    
    if (matchHistory.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#64748B; padding: 3rem;">No matches yet. Start your first game!</p>`;
        return;
    }
    
    let html = '';
    
    matchHistory.forEach(match => {
        html += `
            <div class="history-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${match.teamA} vs ${match.teamB}</strong><br>
                        <small style="color:#94A3B8">${new Date(match.date).toLocaleDateString()}</small>
                    </div>
                    <div style="text-align:right; color:var(--accent); font-weight:700;">
                        ${match.battingTeam}<br>
                        \( {match.score}/ \){match.wickets}
                    </div>
                </div>
                <div style="margin-top:8px; font-size:0.9rem; color:#86EFAC;">
                    ${match.result || 'Completed'}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Initialize everything
function initializeApp() {
    loadHistory();
    initSplash();
    
    // Keyboard shortcuts for scoring (useful on desktop)
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('live-match-screen').classList.contains('hidden')) return;
        
        if (e.key === '0') addScore(0);
        if (e.key === '1') addScore(1);
        if (e.key === '2') addScore(2);
        if (e.key === '3') addScore(3);
        if (e.key === '4') addScore(4);
        if (e.key === '6') addScore(6);
        if (e.key.toLowerCase() === 'w') addWicket();
    });
}

// Start the app
window.onload = initializeApp;
