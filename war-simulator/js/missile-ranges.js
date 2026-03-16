function createRangeCircle(center, rangeKm, fillColor, borderColor, label) {
    return L.circle(center, {
        radius: rangeKm * 1000,
        fillColor: fillColor,
        color: borderColor,
        weight: 2,
        opacity: 0.8,
        dashArray: '10, 10',
        fillOpacity: 0.15,
        interactive: true,
        pane: 'rangePane'
    }).bindPopup(`
        <div class="range-popup">
            <h4>${label}</h4>
            <p><strong>射程:</strong> ${rangeKm} km</p>
        </div>
    `);
}

function addMissileRanges() {
    const iranRanges = [
        { radius: 1000, color: 'rgba(251, 191, 36, 0.15)', border: '#fbbf24', label: '短程覆盖区' },
        { radius: 3000, color: 'rgba(245, 158, 11, 0.12)', border: '#f59e0b', label: '中短程覆盖区' },
        { radius: 5500, color: 'rgba(234, 88, 12, 0.10)', border: '#ea580c', label: '中程覆盖区' }
    ];
    
    iranRanges.forEach(range => {
        const circle = createRangeCircle([35.6892, 51.3890], range.radius, range.color, range.border, range.label);
        window.mapLayers.ranges.addLayer(circle);
    });
    
    const israelRanges = [
        { radius: 1000, color: 'rgba(96, 165, 250, 0.15)', border: '#60a5fa', label: '短程覆盖区' },
        { radius: 3000, color: 'rgba(66, 153, 225, 0.12)', border: '#3b82f6', label: '中短程覆盖区' },
        { radius: 11500, color: 'rgba(37, 99, 235, 0.08)', border: '#2563eb', label: '洲际覆盖区' }
    ];
    
    israelRanges.forEach(range => {
        const circle = createRangeCircle([32.0853, 34.7818], range.radius, range.color, range.border, range.label);
        window.mapLayers.ranges.addLayer(circle);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.mapLayers) {
            addMissileRanges();
        }
    }, 1000);
});