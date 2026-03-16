async function loadMilitaryData() {
    try {
        const response = await fetch('data/military-deployments.json');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to load military data:', error);
        return null;
    }
}

function createUnitMarker(unit, factionColor) {
    let iconHtml = '';
    let iconSize = [24, 24];
    
    switch (unit.type) {
        case 'navy':
            iconHtml = '<div style="font-size:16px; color:white;">⚓</div>';
            break;
        case 'airbase':
            iconHtml = '<div style="font-size:16px; color:white;">✈️</div>';
            break;
        case 'missile_launcher':
            iconHtml = '<div style="font-size:16px; color:white;">🚀</div>';
            break;
        case 'army':
            iconHtml = '<div style="font-size:16px; color:white;">🛡️</div>';
            break;
        case 'radar':
            iconHtml = '<div style="font-size:16px; color:white;">📡</div>';
            break;
        case 'naval_port':
            iconHtml = '<div style="font-size:16px; color:white;">🛥️</div>';
            break;
        default:
            iconHtml = '<div style="font-size:16px; color:white;">●</div>';
    }
    
    const markerIcon = L.divIcon({
        className: 'military-marker',
        html: `
            <div style="
                background-color: ${factionColor};
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">
                ${iconHtml}
            </div>
        `,
        iconSize: iconSize,
        iconAnchor: [12, 12]
    });
    
    const marker = L.marker([unit.location[0], unit.location[1]], { icon: markerIcon });
    
    const popupContent = `
        <div class="unit-popup">
            <h4>${unit.name}</h4>
            <p><strong>国家:</strong> ${unit.country}</p>
            <p><strong>类型:</strong> ${unit.type}</p>
            <p><strong>状态:</strong> ${unit.status}</p>
            <p><strong>资产:</strong> ${unit.assets.join(', ')}</p>
            <p><strong>武器:</strong> ${unit.weapons.join(', ')}</p>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    return marker;
}

function renderMilitaryForces(data) {
    data.factions.coalition.units.forEach(unit => {
        const marker = createUnitMarker(unit, '#2563eb');
        window.mapLayers.coalition.addLayer(marker);
    });
    
    data.factions.iran.units.forEach(unit => {
        const marker = createUnitMarker(unit, '#dc2626');
        window.mapLayers.iran.addLayer(marker);
    });
    
    if (data.factions.proxy) {
        data.factions.proxy.units.forEach(unit => {
            const marker = createUnitMarker(unit, '#ea580c');
            window.mapLayers.proxy.addLayer(marker);
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const militaryData = await loadMilitaryData();
    if (militaryData) {
        renderMilitaryForces(militaryData);
    }
});