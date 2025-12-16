document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const matchesContainer = document.getElementById('matches-container');
    const refreshBtn = document.getElementById('refresh-btn');
    const loadingIndicator = document.getElementById('loading-indicator');

    // API Endpoints (ESPN)
    const APIS = {
        'premier-league': 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
        'la-liga': 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard',
        'serie-a': 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard'
    };

    let currentLeague = 'all';
    let allMatches = [];

    // Fetch Data
    async function fetchScores() {
        showLoading(true);
        allMatches = []; // Clear current data

        try {
            // Fetch all leagues in parallel
            const promises = Object.entries(APIS).map(async ([leagueKey, url]) => {
                const response = await fetch(url);
                const data = await response.json();
                return data.events.map(event => processMatchData(event, leagueKey));
            });

            const results = await Promise.all(promises);
            allMatches = results.flat();

            // Sort by date/status (Live first, then upcoming)
            allMatches.sort((a, b) => {
                if (a.status.type.state === 'in' && b.status.type.state !== 'in') return -1;
                if (a.status.type.state !== 'in' && b.status.type.state === 'in') return 1;
                return new Date(a.date) - new Date(b.date);
            });

            renderMatches();
        } catch (error) {
            console.error('Error fetching scores:', error);
            matchesContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-losing">
                    <span class="material-symbols-outlined text-4xl mb-2">error</span>
                    <p>Failed to load scores. Please try again.</p>
                </div>
            `;
        } finally {
            showLoading(false);
        }
    }

    // Process ESPN Data into our format
    function processMatchData(event, leagueKey) {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        return {
            id: event.id,
            league: leagueKey,
            leagueName: getLeagueName(leagueKey),
            date: event.date,
            status: event.status, // { type: { state: 'in'|'pre'|'post', description: '2nd Half' }, displayClock: '78\'' }
            home: {
                name: homeTeam.team.shortDisplayName,
                logo: homeTeam.team.logo,
                score: homeTeam.score
            },
            away: {
                name: awayTeam.team.shortDisplayName,
                logo: awayTeam.team.logo,
                score: awayTeam.score
            }
        };
    }

    function getLeagueName(key) {
        switch (key) {
            case 'premier-league': return 'Premier League';
            case 'la-liga': return 'La Liga';
            case 'serie-a': return 'Serie A';
            default: return '';
        }
    }

    // Render Matches
    function renderMatches() {
        // Clear container but keep loading indicator (hidden)
        matchesContainer.innerHTML = '';
        matchesContainer.appendChild(loadingIndicator);

        const filteredMatches = currentLeague === 'all'
            ? allMatches
            : allMatches.filter(m => m.league === currentLeague);

        if (filteredMatches.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'flex flex-col items-center justify-center py-10 text-text-secondary-dark opacity-60';
            emptyMsg.innerHTML = '<p>No matches found for today.</p>';
            matchesContainer.appendChild(emptyMsg);
            return;
        }

        filteredMatches.forEach(match => {
            const card = createMatchCard(match);
            matchesContainer.appendChild(card);

            // Animation
            card.animate([
                { opacity: 0, transform: 'translateY(10px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], {
                duration: 300,
                easing: 'ease-out'
            });
        });
    }

    function createMatchCard(match) {
        const isLive = match.status.type.state === 'in';
        const isFinished = match.status.type.state === 'post';
        const isScheduled = match.status.type.state === 'pre';

        // Determine status color and text
        let statusHtml = '';
        if (isLive) {
            statusHtml = `
                <div class="flex items-center gap-2 text-primary">
                    <span class="relative flex h-2 w-2">
                        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                        <span class="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                    </span>
                    <p class="text-sm font-bold uppercase">${match.status.displayClock}</p>
                </div>`;
        } else if (isFinished) {
            statusHtml = `<p class="text-sm font-bold uppercase text-text-secondary-dark">Finished</p>`;
        } else {
            const time = new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            statusHtml = `<p class="text-sm font-bold uppercase text-text-secondary-dark">${time}</p>`;
        }

        // Score colors
        const homeScoreColor = getScoreColor(match.home.score, match.away.score, isScheduled);
        const awayScoreColor = getScoreColor(match.away.score, match.home.score, isScheduled);

        const div = document.createElement('div');
        div.className = 'match-card flex flex-col rounded-xl bg-card-dark card-magazine-shadow transition-all hover:scale-[1.01] cursor-pointer mb-4';
        div.innerHTML = `
            <div class="px-4 pt-4">
                <p class="text-xs font-semibold text-text-secondary-dark uppercase tracking-wider">${match.leagueName}</p>
                <div class="mt-3 flex flex-col gap-3 ${isScheduled ? 'opacity-70' : ''}">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <img class="h-8 w-8 object-contain logo-embroidered" src="${match.home.logo}" alt="${match.home.name}">
                            <span class="text-base font-bold">${match.home.name}</span>
                        </div>
                        <span class="text-xl font-bold ${homeScoreColor} font-sans-score">${isScheduled ? '-' : match.home.score}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <img class="h-8 w-8 object-contain logo-embroidered" src="${match.away.logo}" alt="${match.away.name}">
                            <span class="text-base font-bold">${match.away.name}</span>
                        </div>
                        <span class="text-xl font-bold ${awayScoreColor} font-sans-score">${isScheduled ? '-' : match.away.score}</span>
                    </div>
                </div>
            </div>
            <div class="mt-4 flex justify-center border-t border-border-dark py-3 bg-black/10 rounded-b-xl">
                ${statusHtml}
            </div>
        `;
        return div;
    }

    function getScoreColor(score, opponentScore, isScheduled) {
        if (isScheduled) return 'text-text-primary-dark';
        const s1 = parseInt(score);
        const s2 = parseInt(opponentScore);
        if (s1 > s2) return 'text-leading';
        if (s1 < s2) return 'text-losing';
        return 'text-tied';
    }

    function showLoading(show) {
        loadingIndicator.style.display = show ? 'flex' : 'none';
    }

    // Tab Switching Logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('border-b-primary', 'text-text-primary-dark');
                t.classList.add('border-b-transparent', 'text-text-secondary-dark');
            });
            tab.classList.remove('border-b-transparent', 'text-text-secondary-dark');
            tab.classList.add('border-b-primary', 'text-text-primary-dark');

            currentLeague = tab.getAttribute('data-tab');
            renderMatches();
        });
    });

    // Refresh Button
    refreshBtn.addEventListener('click', () => {
        const icon = refreshBtn.querySelector('span');
        icon.classList.add('animate-spin');
        fetchScores().then(() => {
            setTimeout(() => icon.classList.remove('animate-spin'), 500);
        });
    });

    // Initial Fetch
    fetchScores();
});
