const map = L.map('map', {
    center: [28.5, 46.5],
    zoom: 6,
    minZoom: 5,
    maxZoom: 12,
    maxBounds: [[10.0, 28.0], [42.0, 65.0]],
    maxBoundsViscosity: 0.8
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const coalitionForces = L.layerGroup().addTo(map);
const iranForces = L.layerGroup().addTo(map);
const proxyForces = L.layerGroup().addTo(map);
const missileRanges = L.layerGroup().addTo(map);
const missileTrajectories = L.layerGroup().addTo(map);
const missileImpacts = L.layerGroup().addTo(map);
const strategicFacilities = L.layerGroup().addTo(map);

map.createPane('rangePane');
map.getPane('rangePane').style.zIndex = 50;

const legendControl = L.control({position: 'bottomright'});

legendControl.onAdd = function() {
    const legendDiv = L.DomUtil.create('div', 'info legend');
    legendDiv.innerHTML = `
        <h4>图例</h4>
        <div><span style="background:#2563eb"></span> 美以联军</div>
        <div><span style="background:#dc2626"></span> 伊朗部队</div>
        <div><span style="background:#ea580c"></span> 代理武装</div>
        <div><span style="background:#f59e0b; opacity:0.3"></span> 导弹射程区</div>
        <div><span style="background:#fbbf24"></span> 打击落点</div>
    `;
    return legendDiv;
};

legendControl.addTo(map);

window.mapLayers = {
    coalition: coalitionForces,
    iran: iranForces,
    proxy: proxyForces,
    ranges: missileRanges,
    trajectories: missileTrajectories,
    impacts: missileImpacts,
    facilities: strategicFacilities
};