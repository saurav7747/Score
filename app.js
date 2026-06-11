// app.js

// State Management Container
let state = {
    activeMatchId: null,
    matches: {},
    currentInnings: 1, // 1 or 2
    striker: 'p1', // 'p1' or 'p2'
    ballHistory: [] // current innings deliveries tracked for visual logs and undo arrays
};

// Default Match Schema
function createMatchSchema(teamA, teamB, overs, tossWinner, tossDecision) {
    const isABatting = (tossWinner === 'A' && tossDecision === 'bat') || (tossWinner === 'B' && tossDecision === 'bowl');
    return {
        id: 'match_' + Date.now(),
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        teamA: teamA,
        teamB: teamB,
        maxOvers: parseInt(overs),
        tossWinner: tossWinner === 'A' ? teamA : teamB,
        tossDecision: tossDecision,
        status: 'live', // live, completed
        winner: null,
        margin: null,
        innings1: {
            battingTeam: isABatting ? teamA : teamB,
            bowlingTeam: isABatting ? teamB : teamA,
            runs: 0,
            wickets: 0,
            balls: 0,
            p1: { name: 'Batsman 1', runs: 0, balls: 0, fours: 0, sixes: 0 },
            p2: { name: 'Batsman 2', runs: 0, balls: 0, fours: 0, sixes: 0 },
            bowler: { name: 'Bowler', overs: 0, runs: 0, wickets: 0, balls: 0 },
            timeline: []
        },
        innings2: {
            battingTeam: isABatting ? teamB : teamA,
            bowlingTeam: isABatting ? teamA : teamB,
            runs: 0,
            wickets: 0,
            balls: 0,
            p1: { name: 'Batsman 1', runs: 0, balls: 0, fours: 0, sixes: 0 },
            p2: { name: 'Batsman 2', runs: 0, balls: 0, fours: 0, sixes: 0 },
            bowler: { name: 'Bowler', overs: 0, runs: 0, wickets: 0, balls: 0 },
            timeline: []
        }
    };
}

// Initialization and Lifecycle
document.addEventListener('DOMContentLoaded', () => {
    loadStateFromStorage();
    setupSplashSequence();
    registerEventListeners();
    setupPWAInstallation();
    renderDashboardActiveMatch();
});

function setupSplashSequence() {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        const container = document.getElementById('app-container');
        splash.classList.add('fade-out');
        container.classList.remove('hidden');
    }, 400); 
}

function loadStateFromStorage() {
    const savedMatches = localStorage.getItem('sauravscore_matches');
    const savedActiveId = localStorage.getItem('sauravscore_active_id');
    const savedInnings = localStorage.getItem('sauravscore_innings');
    const savedStriker = localStorage.getItem('sauravscore_striker');

    if (savedMatches) state.matches = JSON.parse(savedMatches);
    if (savedActiveId) state.activeMatchId = savedActiveId;
    if (savedInnings) state.currentInnings = parseInt(savedInnings);
    if (savedStriker) state.striker = savedStriker;
}

function saveStateToStorage() {
    localStorage.setItem('sauravscore_matches', JSON.stringify(state.matches));
    localStorage.setItem('sauravscore_active_id', state.activeMatchId || '');
    localStorage.setItem('sauravscore_innings', state.currentInnings.toString());
    localStorage.setItem('sauravscore_striker', state.striker);
}

// Router View Switcher
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    window.scrollTo(0,0);
}

// Event Listeners Routing Wireframe
function registerEventListeners() {
    // Dashboard Navigation
    document.getElementById('btn-new-match').addEventListener('click', () => switchView('view-create-match'));
    document.getElementById('btn-history').addEventListener('click', () => {
        renderHistoryList();
        switchView('view-history');
    });

    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => {
            renderDashboardActiveMatch();
            switchView('view-dashboard');
        });
    });

    document.getElementById('btn-score-back').addEventListener('click', () => {
        renderDashboardActiveMatch();
        switchView('view-dashboard');
    });

    // Match Creation Form Submit
    document.getElementById('form-create-match').addEventListener('submit', (e) => {
        e.preventDefault();
        const teamA = document.getElementById('team-a').value.trim();
        const teamB = document.getElementById('team-b').value.trim();
        const overs = document.getElementById('match-overs').value;
        const tossWinner = document.getElementById('toss-winner').value;
        const tossDecision = document.getElementById('toss-decision').value;

        const newMatch = createMatchSchema(teamA, teamB, overs, tossWinner, tossDecision);
        state.matches[newMatch.id] = newMatch;
        state.activeMatchId = newMatch.id;
        state.currentInnings = 1;
        state.striker = 'p1';
        
        // Sync custom UI inputs
        document.getElementById('p1-name').value = "Batsman 1";
        document.getElementById('p2-name').value = "Batsman 2";
        document.getElementById('bowl-name').value = "Bowler";

        saveStateToStorage();
        loadScoreboardView();
    });

    // Score action triggers
    document.querySelectorAll('.btn-score').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.currentTarget.getAttribute('data-value');
            handleBallDelivery(val);
        });
    });

    // Extra Operational controls
    document.getElementById('btn-undo').addEventListener('click', handleUndoAction);
    document.getElementById('btn-end-over').addEventListener('click', () => {
        state.striker = state.striker === 'p1' ? 'p2' : 'p1';
        saveStateToStorage();
        updateScoreboardUI();
    });
    document.getElementById('btn-end-innings').addEventListener('click', forceTransitionInnings);
    document.getElementById('btn-reset-match').addEventListener('click', resetActiveMatch);

    // Export Trigger
    document.getElementById('btn-export-match').addEventListener('click', () => {
        if(!state.activeMatchId) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.matches[state.activeMatchId], null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `${state.matches[state.activeMatchId].id}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });

    // Inline Editorial Panels
    const editPanel = document.getElementById('panel-edit-score');
    document.getElementById('btn-edit-score').addEventListener('click', () => {
        const match = state.matches[state.activeMatchId];
        const inn = state.currentInnings === 1 ? match.innings1 : match.innings2;
        document.getElementById('edit-runs').value = inn.runs;
        document.getElementById('edit-wickets').value = inn.wickets;
        document.getElementById('edit-balls').value = inn.balls;
        editPanel.classList.remove('hidden');
    });

    document.getElementById('btn-edit-cancel').addEventListener('click', () => editPanel.classList.add('hidden'));
    document.getElementById('btn-edit-save').addEventListener('click', () => {
        const match = state.matches[state.activeMatchId];
        const inn = state.currentInnings === 1 ? match.innings1 : match.innings2;
        inn.runs = parseInt(document.getElementById('edit-runs').value) || 0;
        inn.wickets = parseInt(document.getElementById('edit-wickets').value) || 0;
        inn.balls = parseInt(document.getElementById('edit-balls').value) || 0;
        
        editPanel.classList.add('hidden');
        evaluateMatchLogicBoundaries();
        saveStateToStorage();
        updateScoreboardUI();
    });

    // Text Sync for Names
    ['p1-name', 'p2-name', 'bowl-name'].forEach(id => {
        document.getElementById(id).addEventListener('input', (e) => {
            if (!state.activeMatchId) return;
            const match = state.matches[state.activeMatchId];
            const inn = state.currentInnings === 1 ? match.innings1 : match.innings2;
            const targetKey = id === 'bowl-name' ? 'bowler' : (id === 'p1-name' ? 'p1' : 'p2');
            inn[targetKey].name = e.target.value;
            saveStateToStorage();
        });
    });
}

// Engine Processing Logic
function handleBallDelivery(input) {
    const match = state.matches[state.activeMatchId];
    if (!match || match.status === 'completed') return;

    const inn = state.currentInnings === 1 ? match.innings1 : match.innings2;
    
    // Create snapshot for advanced exact state inversion tracking (Undo system)
    const logSnapshot = {
        input: input,
        strikerBefore: state.striker,
        p1: { ...inn.p1 },
        p2: { ...inn.p2 },
        bowler: { ...inn.bowler },
        runs: inn.runs,
        wickets: inn.wickets,
        balls: inn.balls
    };
    inn.timeline.push(logSnapshot);

    let runIncrement = 0;
    let isExtra = false;
    let isValidBall = true;

    if (input === 'WD') {
        runIncrement = 1;
        isExtra = true;
        isValidBall = false;
    } else if (input === 'NB') {
        runIncrement = 1;
        isExtra = true;
        isValidBall = false;
    } else if (input === 'W') {
        inn.wickets += 1;
        inn.bowler.wickets += 1;
    } else {
        runIncrement = parseInt(input);
        // Track unique boundaries for striking profiles
        if (runIncrement === 4) inn[state.striker].fours += 1;
        if (runIncrement === 6) inn[state.striker].sixes += 1;
    }

    // Apply runs allocations
    inn.runs += runIncrement;
    inn.bowler.runs += runIncrement;

    if (!isExtra) {
        inn[state.striker].runs += runIncrement;
    }

    if (isValidBall) {
        inn.balls += 1;
        inn[state.striker].balls += 1;
        inn.bowler.balls += 1;
        
        // Auto single run track shifting matrix
        if (runIncrement % 2 !== 0 && input !== 'W') {
            state.striker = state.striker === 'p1' ? 'p2' : 'p1';
        }

        // Automatic Over Completeness Processing
        if (inn.balls % 6 === 0) {
            inn.bowler.overs += 1;
            inn.bowler.balls = 0;
            state.striker = state.striker === 'p1' ? 'p2' : 'p1'; // Over cross rotation
        }
    } else {
        if (input === 'WD' || input === 'NB') {
            // Addition run calculations for boundaries hit via no-balls can expand here
        }
    }

    evaluateMatchLogicBoundaries();
    saveStateToStorage();
    updateScoreboardUI();
}

function handleUndoAction() {
    const match = state.matches[state.activeMatchId];
    if (!match) return;
    const inn = state.currentInnings === 1 ? match.innings1 : match.innings2;
    
    if (inn.timeline.length === 0) return;

    const lastState = inn.timeline.pop();
    
    // Total reversion parameter inversion matrix
    state.striker = lastState.strikerBefore;
    inn.p1 = lastState.p1;
    inn.p2 = lastState.p2;
    inn.bowler = lastState.bowler;
    inn.runs = lastState.runs;
    inn.wickets = lastState.wickets;
    inn.balls = lastState.balls;

    // Revert status configurations if undone from completion
    if(match.status === 'completed') {
        match.status = 'live';
        match.winner = null;
        match.margin = null;
    }

    saveStateToStorage();
    updateScoreboardUI();
}

function evaluateMatchLogicBoundaries() {
    const match = state.matches[state.activeMatchId];
    if (!match) return;

    const maxBalls = match.maxOvers * 6;

    // Innings 1 evaluation logic
    if (state.currentInnings === 1) {
        const inn1 = match.innings1;
        if (inn1.balls >= maxBalls || inn1.wickets >= 10) {
            forceTransitionInnings();
        }
    } 
    // Innings 2 evaluation logic (Chasing validation parameters)
    else if (state.currentInnings === 2) {
        const inn1 = match.innings1;
        const inn2 = match.innings2;
        const target = inn1.runs + 1;

        if (inn2.runs >= target) {
            // Batting Team Chased Successfully
            match.status = 'completed';
            match.winner = inn2.battingTeam;
            match.margin = `${10 - inn2.wickets} wickets`;
            finalizeActiveMatchInstance();
        } else if (inn2.balls >= maxBalls || inn2.wickets >= 10) {
            match.status = 'completed';
            if (inn2.runs === inn1.runs) {
                match.winner = 'Tie';
                match.margin = 'Match drawn';
            } else {
                match.winner = inn1.battingTeam;
                match.margin = `${inn1.runs - inn2.runs} runs`;
            }
            finalizeActiveMatchInstance();
        }
    }
}

function forceTransitionInnings() {
    const match = state.matches[state.activeMatchId];
    if (state.currentInnings === 1) {
        state.currentInnings = 2;
        state.striker = 'p1';
        saveStateToStorage();
        
        // Re-inject pristine text metrics safely for player identity forms
        document.getElementById('p1-name').value = "Batsman 1";
        document.getElementById('p2-name').value = "Batsman 2";
        document.getElementById('bowl-name').value = "Bowler";
        
        updateScoreboardUI();
    }
}

function finalizeActiveMatchInstance() {
    state.activeMatchId = null; 
    localStorage.removeItem('sauravscore_active_id');
}

function resetActiveMatch() {
    if (!confirm("Reset this match completely? Action cannot be undone.")) return;
    const match = state.matches[state.activeMatchId];
    if(match) {
        const structuralReset = createMatchSchema(match.teamA, match.teamB, match.maxOvers, "A", "bat"); 
        structuralReset.id = match.id; 
        structuralReset.date = match.date;
        state.matches[match.id] = structuralReset;
        state.currentInnings = 1;
        state.striker = 'p1';
        saveStateToStorage();
        updateScoreboardUI();
    }
}

// UI Rendering Adapters
function loadScoreboardView() {
    if (!state.activeMatchId) return;
    switchView('view-scoreboard');
    updateScoreboardUI();
}

function updateScoreboardUI() {
    const match = state.matches[state.activeMatchId || localStorage.getItem('sauravscore_active_id')];
    if (!match) return;

    const inn = state.currentInnings === 1 ? match.innings1 : match.innings2;

    // Master Score & Meta Headers rendering
    document.getElementById('display-team-batting').textContent = inn.battingTeam;
    document.getElementById('display-runs').textContent = inn.runs;
    document.getElementById('display-wickets').textContent = inn.wickets;
    
    // Format Overs correctly (e.g. 4.2 overs)
    const exactOversStr = `${Math.floor(inn.balls / 6)}.${inn.balls % 6}`;
    document.getElementById('display-overs').textContent = `${exactOversStr} Overs`;

    // Compute Rates math algorithms
    const calcOversFloat = (Math.floor(inn.balls / 6)) + ((inn.balls % 6) / 6);
    const crr = calcOversFloat > 0 ? (inn.runs / calcOversFloat).toFixed(2) : "0.00";
    document.getElementById('display-crr').textContent = crr;

    // Conditional processing layout for target chases
    const strip = document.getElementById('display-target-strip');
    const rrrBlock = document.getElementById('block-rrr');
    
    if (state.currentInnings === 2) {
        const target = match.innings1.runs + 1;
        const runsNeeded = target - inn.runs;
        const totalBallsInMatch = match.maxOvers * 6;
        const ballsLeft = totalBallsInMatch - inn.balls;
        const oversLeftFloat = ballsLeft / 6;

        strip.classList.remove('hidden');
        rrrBlock.classList.remove('hidden');
        
        document.getElementById('display-target').textContent = target;
        document.getElementById('display-runs-needed').textContent = runsNeeded;
        document.getElementById('display-balls-left').textContent = ballsLeft;

        const rrr = oversLeftFloat > 0 ? (runsNeeded / oversLeftFloat).toFixed(2) : "0.00";
        document.getElementById('display-rrr').textContent = rrr;
    } else {
        strip.classList.add('hidden');
        rrrBlock.classList.add('hidden');
    }

    // Direct Sync of Inline editable form values
    document.getElementById('p1-name').value = inn.p1.name;
    document.getElementById('p2-name').value = inn.p2.name;
    document.getElementById('bowl-name').value = inn.bowler.name;

    // Striker UI identification node configurations
    document.getElementById('row-p1').className = state.striker === 'p1' ? 'striker-row' : '';
    document.getElementById('row-p2').className = state.striker === 'p2' ? 'striker-row' : '';

    // Batsmen Stats computations mapping
    document.getElementById('p1-runs').textContent = inn.p1.runs;
    document.getElementById('p1-balls').textContent = inn.p1.balls;
    document.getElementById('p1-fours').textContent = inn.p1.fours;
    document.getElementById('p1-sixes').textContent = inn.p1.sixes;
    document.getElementById('p1-sr').textContent = inn.p1.balls > 0 ? ((inn.p1.runs / inn.p1.balls) * 100).toFixed(1) : "0.0";

    document.getElementById('p2-runs').textContent = inn.p2.runs;
    document.getElementById('p2-balls').textContent = inn.p2.balls;
    document.getElementById('p2-fours').textContent = inn.p2.fours;
    document.getElementById('p2-sixes').textContent = inn.p2.sixes;
    document.getElementById('p2-sr').textContent = inn.p2.balls > 0 ? ((inn.p2.runs / inn.p2.balls) * 100).toFixed(1) : "0.0";

    // Bowler calculation updates
    const bowlerOversDisplay = `${inn.bowler.overs}.${inn.bowler.balls}`;
    document.getElementById('bowl-overs').textContent = bowlerOversDisplay;
    document.getElementById('bowl-runs').textContent = inn.bowler.runs;
    document.getElementById('bowl-wickets').textContent = inn.bowler.wickets;
    
    const totalBowlerOversFloat = inn.bowler.overs + (inn.bowler.balls / 6);
    document.getElementById('bowl-econ').textContent = totalBowlerOversFloat > 0 ? (inn.bowler.runs / totalBowlerOversFloat).toFixed(2) : "0.00";

    // Manage Scoring Panels lock bounds based on complete status
    const controlsBoard = document.getElementById('scoring-control-board');
    const resultBanner = document.getElementById('match-result-banner');
    const activePlayersSection = document.getElementById('active-players-section');

    if (match.status === 'completed') {
        controlsBoard.classList.add('hidden');
        activePlayersSection.classList.add('hidden');
        resultBanner.classList.remove('hidden');
        
        document.getElementById('display-result-winner').textContent = `${match.winner.toUpperCase()} MATCH WINNER`;
        document.getElementById('display-result-margin').textContent = `Won by ${match.margin}`;
        document.getElementById('display-result-scores').textContent = `${match.innings1.battingTeam}: ${match.innings1.runs}/${match.innings1.wickets} | ${match.innings2.battingTeam}: ${match.innings2.runs}/${match.innings2.wickets}`;
    } else {
        controlsBoard.classList.remove('hidden');
        activePlayersSection.classList.remove('hidden');
        resultBanner.classList.add('hidden');
    }

    renderBallTimelineStream(inn.timeline);
}

function renderBallTimelineStream(timeline) {
    const streamContainer = document.getElementById('ball-history-stream');
    streamContainer.innerHTML = '';

    if (timeline.length === 0) {
        streamContainer.innerHTML = '<span class="text-muted text-sm">No balls delivered yet in this innings.</span>';
        return;
    }

    // Slice and reverse timeline items to populate newest entries first on left side
    const invertedLogs = [...timeline].reverse();
    
    invertedLogs.forEach((log) => {
        const node = document.createE
        
