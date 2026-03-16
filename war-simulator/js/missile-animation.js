let missileCount = 0;
let activeMissiles = new Map();
let simulationRunning = false;
let simulationInterval;

function createMissileTrajectory(from, to, factionColor, missileType) {
    const line = L.polyline([from, to], {
        color: factionColor,
        weight: 3,
        opacity: 0.9,
        pane: 'overlayPane'
    });
    
    const midPoint = [
        (from[0] + to[0]) / 2,
        (from[1] + to[1]) / 2
    ];
    
    const arrowIcon = L.divIcon({
        className: 'trajectory-arrow',
        html: `<div style="
            width: 24px;
            height: 24px;
            background-color: ${factionColor};
            clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    const arrow = L.marker(midPoint, { icon: arrowIcon });
    const trajectoryGroup = L.layerGroup([line, arrow]);
    
    return trajectoryGroup;
}

function createImpactMarker(position) {
    const impactIcon = L.divIcon({
        className: 'impact-marker',
        html: `<div style="
            width: 20px;
            height: 20px;
            background-color: #fbbf24;
            border-radius: 50%;
            box-shadow: 0 0 10px #f59e0b;
            animation: pulse-impact 1.5s ease-out infinite;
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    const impact = L.marker(position, { icon: impactIcon });
    return impact;
}

function simulateMissileLaunch() {
    if (!simulationRunning) return;
    
    const factions = ['coalition', 'iran'];
    const launchFaction = factions[Math.floor(Math.random() * factions.length)];
    const targetFaction = launchFaction === 'coalition' ? 'iran' : 'coalition';
    
    fetch('data/military-deployments.json')
        .then(response => response.json())
        .then(data => {
            let launchers = [];
            let targets = [];
            
            if (launchFaction === 'coalition') {
                launchers = data.factions.coalition.units.filter(u => 
                    u.type === 'missile_launcher' || u.type === 'airbase'
                );
                targets = data.factions.iran.units;
            } else {
                launchers = data.factions.iran.units.filter(u => 
                    u.type === 'missile_launcher'
                );
                targets = data.factions.coalition.units;
            }
            
            if (launchers.length === 0 || targets.length === 0) return;
            
            const launcher = launchers[Math.floor(Math.random() * launchers.length)];
            const target = targets[Math.floor(Math.random() * targets.length)];
            
            const from = [launcher.location[0], launcher.location[1]];
            const to = [target.location[0], target.location[1]];
            const factionColor = launchFaction === 'coalition' ? '#2563eb' : '#dc2626';
            
            const trajectory = createMissileTrajectory(from, to, factionColor, 'ballistic');
            window.mapLayers.trajectories.addLayer(trajectory);
            
            missileCount++;
            updateMissileCounter();
            
            setTimeout(() => {
                const impact = createImpactMarker(to);
                window.mapLayers.impacts.addLayer(impact);
                
                setTimeout(() => {
                    window.mapLayers.trajectories.removeLayer(trajectory);
                    window.mapLayers.impacts.removeLayer(impact);
                }, 3000);
            }, 2000);
        })
        .catch(error => console.error('Failed to load military data for missile launch:', error));
}

function startSimulation() {
    if (simulationRunning) return;
    simulationRunning = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    
    simulationInterval = setInterval(() => {
        if (Math.random() > 0.3) {
            simulateMissileLaunch();
        }
    }, Math.random() * 3000 + 2000);
}

function pauseSimulation() {
    if (!simulationRunning) return;
    simulationRunning = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    clearInterval(simulationInterval);
}

function updateMissileCounter() {
    document.getElementById('count').textContent = missileCount;
}

document.getElementById('startBtn').addEventListener('click', startSimulation);
document.getElementById('pauseBtn').addEventListener('click', pauseSimulation);

const style = document.createElement('style');
style.textContent = `
    @keyframes pulse-impact {
        0% {
            transform: scale(1);
            opacity: 1;
        }
        100% {
            transform: scale(2.5);
            opacity: 0;
        }
    }
    .trajectory-arrow {
        pointer-events: none;
    }
`;
document.head.appendChild(style);

document.getElementById('pauseBtn').disabled = true;