class WarSimulatorControls {
    constructor() {
        this.layerVisibility = {
            coalition: true,
            iran: true,
            proxy: true,
            ranges: true,
            trajectories: true,
            impacts: true,
            facilities: true
        };
        this.initControls();
    }
    
    initControls() {
        this.createLayerSwitcher();
        this.createTimelineControl();
        this.bindEvents();
    }
    
    createLayerSwitcher() {
        const layerSwitcher = document.createElement('div');
        layerSwitcher.className = 'layer-switcher';
        layerSwitcher.innerHTML = `
            <div class="control-panel">
                <h4>图层控制</h4>
                <label><input type="checkbox" id="coalition-layer" checked> 美以联军</label>
                <label><input type="checkbox" id="iran-layer" checked> 伊朗部队</label>
                <label><input type="checkbox" id="proxy-layer" checked> 代理武装</label>
                <label><input type="checkbox" id="ranges-layer" checked> 导弹射程</label>
                <label><input type="checkbox" id="trajectories-layer" checked> 导弹轨迹</label>
                <label><input type="checkbox" id="impacts-layer" checked> 打击落点</label>
            </div>
        `;
        
        const mapContainer = document.getElementById('map');
        mapContainer.parentNode.insertBefore(layerSwitcher, mapContainer.nextSibling);
    }
    
    createTimelineControl() {
        const timelineControl = document.createElement('div');
        timelineControl.className = 'timeline-control';
        timelineControl.innerHTML = `
            <div class="control-panel">
                <h4>模拟控制</h4>
                <div class="timeline-slider">
                    <input type="range" id="speed-control" min="1" max="10" value="5">
                    <span>速度: <span id="speed-value">5</span></span>
                </div>
                <div class="auto-launch">
                    <label><input type="checkbox" id="auto-launch"> 自动发射</label>
                </div>
            </div>
        `;
        
        const mapContainer = document.getElementById('map');
        mapContainer.parentNode.insertBefore(timelineControl, mapContainer.nextSibling);
    }
    
    bindEvents() {
        document.getElementById('coalition-layer').addEventListener('change', (e) => {
            this.toggleLayer('coalition', e.target.checked);
        });
        
        document.getElementById('iran-layer').addEventListener('change', (e) => {
            this.toggleLayer('iran', e.target.checked);
        });
        
        document.getElementById('proxy-layer').addEventListener('change', (e) => {
            this.toggleLayer('proxy', e.target.checked);
        });
        
        document.getElementById('ranges-layer').addEventListener('change', (e) => {
            this.toggleLayer('ranges', e.target.checked);
        });
        
        document.getElementById('trajectories-layer').addEventListener('change', (e) => {
            this.toggleLayer('trajectories', e.target.checked);
        });
        
        document.getElementById('impacts-layer').addEventListener('change', (e) => {
            this.toggleLayer('impacts', e.target.checked);
        });
        
        const speedControl = document.getElementById('speed-control');
        const speedValue = document.getElementById('speed-value');
        speedControl.addEventListener('input', (e) => {
            speedValue.textContent = e.target.value;
        });
        
        document.getElementById('auto-launch').addEventListener('change', (e) => {
            const autoLaunch = e.target.checked;
            if (autoLaunch && window.startSimulation) {
                window.startSimulation();
            } else if (!autoLaunch && window.pauseSimulation) {
                window.pauseSimulation();
            }
        });
    }
    
    toggleLayer(layerName, visible) {
        this.layerVisibility[layerName] = visible;
        if (window.mapLayers && window.mapLayers[layerName]) {
            if (visible) {
                window.mapLayers[layerName].addTo(window.map);
            } else {
                window.map.removeLayer(window.mapLayers[layerName]);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.map) {
            new WarSimulatorControls();
        }
    }, 1500);
});