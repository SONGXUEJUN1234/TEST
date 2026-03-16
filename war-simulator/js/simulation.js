let missileCount = 0;
let simulationRunning = false;
let simulationInterval;

const startSimulation = () => {
    if (simulationRunning) return;
    simulationRunning = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    
    simulationInterval = setInterval(() => {
        updateMissileCounter();
    }, 1000);
};

const pauseSimulation = () => {
    if (!simulationRunning) return;
    simulationRunning = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    clearInterval(simulationInterval);
};

const updateMissileCounter = () => {
    document.getElementById('count').textContent = missileCount;
};

document.getElementById('startBtn').addEventListener('click', startSimulation);
document.getElementById('pauseBtn').addEventListener('click', pauseSimulation);

document.getElementById('pauseBtn').disabled = true;