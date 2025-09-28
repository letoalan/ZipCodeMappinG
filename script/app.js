// Fonction pour gérer les chemins selon qu'on est en local ou sur GitHub Pages
function getBasePath() {
    const hostname = window.location.hostname;
    if (hostname.includes('github.io')) {
        // Exemple d’URL GitHub Pages : https://username.github.io/mon-projet/
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        // pathParts[0] = "mon-projet" dans cet exemple
        return pathParts.length > 0 ? `/${pathParts[0]}` : '';
    }
    return '.'; // En local
}

const basePath = getBasePath();

// Configuration des fichiers
const GEOJSON_FILE = `${basePath}/sources/nacom.geojson`;
const CSV_FILE = `${basePath}/sources/datanova.csv`;


// Setup map
const map = L.map('map', {zoomControl:true}).setView([46.5, 2.5], 6);

// Basemaps
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap' });
const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution:'Tiles © Esri' });
const esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { attribution:'Labels © Esri', pane:'overlayPane' });

esriSat.addTo(map);
esriTopo.addTo(map);

const baseLayers = {"OSM":osm, "Satellite Esri":esriSat};
const overlays = {"Toponymes Esri":esriTopo};
L.control.layers(baseLayers, overlays).addTo(map);

let allFeatures = [];
let datanovaData = new Map(); // Map: code_postal -> [{code_insee, nom_commune, ...}, ...]
let geojsonLayer = null;
let highlightLayer = L.layerGroup().addTo(map);
let selectedLayer = L.layerGroup().addTo(map);
let groupLayer = L.layerGroup().addTo(map);

// DOM elements
const postcodeInput = document.getElementById('postcode');
const searchBtn = document.getElementById('searchBtn');
const listDiv = document.getElementById('list');
const propSelect = document.getElementById('propSelect');
const propSample = document.getElementById('propSample');
const downloadBtn = document.getElementById('downloadBtn');
const addSelectedBtn = document.getElementById('addSelectedBtn');
const addAllBtn = document.getElementById('addAllBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const selectNoneBtn = document.getElementById('selectNoneBtn');
const clearGroupBtn = document.getElementById('clearGroupBtn');
const coordsOutput = document.getElementById('coordsOutput');
const statusDiv = document.getElementById('status');
const statsDiv = document.getElementById('stats');
const directMode = document.getElementById('directMode');
const searchModeRadios = document.querySelectorAll('input[name="searchMode"]');
const selectionInfo = document.getElementById('selectionInfo');
const coordsInfo = document.getElementById('coordsInfo');
const coordsModeRadios = document.querySelectorAll('input[name="coordsMode"]');


let lastMatches = [];
let groupFeatures = [];
let selectedFeatures = [];
let currentCoordsMode = 'selected';
let currentSearchMode = 'postal';

function showStatus(message, type = 'loading') {
    statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    if (type === 'success' || type === 'error') {
        setTimeout(() => statusDiv.innerHTML = '', 3000);
    }
}

function updateStats() {
    const geoCount = allFeatures.length;
    const csvCount = datanovaData.size;
    statsDiv.innerHTML = `Données chargées: ${geoCount} communes (GeoJSON), ${csvCount} codes postaux (CSV)`;
}

function updateMapHighlight() {
    // Clear existing layers
    highlightLayer.clearLayers();
    selectedLayer.clearLayers();

    // Show all results in red
    if (lastMatches.length > 0) {
        const allResults = L.geoJSON(lastMatches, {
            style: {color: '#e11d48', weight: 2, fillOpacity: 0.1},
            onEachFeature: (f, l) => {
                const name = f.properties.nom_commune || f.properties.nom || f.properties.NOM || 'Commune';
                const code = f.properties.code_postal || f.properties.code || 'N/A';
                const insee = f.properties.code || 'N/A';
                l.bindPopup(`<strong>${name}</strong><br>Code postal: ${code}<br>Code INSEE: ${insee}`);
            }
        });
        allResults.addTo(highlightLayer);
    }

    // Show selected in blue (on top)
    if (selectedFeatures.length > 0) {
        const selectedResults = L.geoJSON(selectedFeatures, {
            style: {color: '#3b82f6', weight: 3, fillOpacity: 0.2},
            onEachFeature: (f, l) => {
                const name = f.properties.nom_commune || f.properties.nom || f.properties.NOM || 'Commune';
                const code = f.properties.code_postal || f.properties.code || 'N/A';
                const insee = f.properties.code || 'N/A';
                l.bindPopup(`<strong>${name}</strong><br>Code postal: ${code}<br>Code INSEE: ${insee}<br><em>Sélectionnée</em>`);
            }
        });
        selectedResults.addTo(selectedLayer);
    }
}

function updateSelectionInfo() {
    const count = selectedFeatures.length;
    const total = lastMatches.length;
    selectionInfo.textContent = `${count}/${total} commune(s) sélectionnée(s)`;

    // Update button states
    addSelectedBtn.disabled = count === 0;
    selectAllBtn.disabled = total === 0 || count === total;
    selectNoneBtn.disabled = count === 0;

    // Update map highlighting
    updateMapHighlight();

    updateCoordsOutput();
}

function updateCoordsOutput() {
    let features = [];
    if (currentCoordsMode === 'selected') {
        features = selectedFeatures;
    } else {
        features = groupFeatures;
    }

    if (features.length === 0) {
        coordsOutput.value = '';
        return;
    }

    const fc = {type: 'FeatureCollection', features: features};
    coordsOutput.value = JSON.stringify(fc, null, 2);
}

// Event listeners for search mode
searchModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        currentSearchMode = e.target.value;
        directMode.style.display = currentSearchMode === 'direct' ? 'block' : 'none';
        clearResults();
    });
});

// Event listeners for coords mode
coordsModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        currentCoordsMode = e.target.value;
        updateCoordsOutput();
    });
});

showStatus('Chargement des données...');

// Load data files with better error handling
showStatus('Chargement des données...');

Promise.all([
    fetch(GEOJSON_FILE)
        .then(r => {
            if (!r.ok) throw new Error(`Erreur ${r.status}: Impossible de charger ${GEOJSON_FILE}`);
            return r.json();
        }),
    fetch(CSV_FILE)
        .then(r => {
            if (!r.ok) throw new Error(`Erreur ${r.status}: Impossible de charger ${CSV_FILE}`);
            return r.text();
        })
]).then(([geojson, csvText]) => {
    // Load GeoJSON
    const features = (geojson.type === 'FeatureCollection') ? geojson.features : (Array.isArray(geojson) ? geojson : []);
    allFeatures = features;
    geojsonLayer = L.geoJSON(geojson, {
        style: {weight: 1, color: '#888', fill: false}
    }).addTo(map);

    // Load CSV data
    datanovaData = parseCSV(csvText);

    // Setup property selector for direct mode
    if (allFeatures.length > 0) {
        const keys = Object.keys(allFeatures[0].properties || {});
        propSelect.innerHTML = keys.map(k => `<option value="${k}">${k}</option>`).join('');
        updatePropSample();
    }

    map.fitBounds(geojsonLayer.getBounds());
    showStatus('Données chargées avec succès', 'success');
    updateStats();

}).catch(error => {
    console.error('Erreur lors du chargement:', error);
    showStatus(`Erreur: ${error.message}`, 'error');
    statusDiv.innerHTML += `
        <div class="status error" style="margin-top:8px;">
          <strong>Vérifiez que les fichiers suivants sont présents :</strong><br>
          • <code>${GEOJSON_FILE}</code><br>
          • <code>${CSV_FILE}</code><br>
          <small>Les fichiers doivent être dans le même répertoire que ce fichier HTML.</small>
        </div>
      `;
});

propSelect.addEventListener('change', updatePropSample);

function updatePropSample() {
    const prop = propSelect.value;
    const samples = allFeatures.map(f => f.properties[prop]).filter(Boolean).slice(0, 6);
    propSample.textContent = samples.length ? 'Exemples: ' + samples.join(', ') : 'Aucun exemple.';
}

// Parse CSV data
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = new Map();

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length >= 4) {
            const record = {
                code_insee: values[0],
                nom_commune: values[1],
                code_postal: values[2],
                libelle_acheminement: values[3]
            };

            const postalCode = record.code_postal;
            if (!data.has(postalCode)) {
                data.set(postalCode, []);
            }
            data.get(postalCode).push(record);
        }
    }
    return data;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseInput(input) {
    return input.split(',').map(x => x.trim()).filter(Boolean);
}

function matchFeature(f, prop, codes) {
    const val = f.properties[prop];
    if (!val) return false;
    const vals = String(val).split(/[; ,]+/);
    return vals.some(v => codes.includes(v));
}

function findCommunesByPostalCode(postalCodes) {
    const results = [];

    for (const postalCode of postalCodes) {
        const communes = datanovaData.get(postalCode);
        if (communes) {
            for (const commune of communes) {
                // Find corresponding feature in GeoJSON by INSEE code
                const feature = allFeatures.find(f =>
                    f.properties.code === commune.code_insee
                );

                if (feature) {
                    // Add commune information to feature
                    const enrichedFeature = {
                        ...feature,
                        properties: {
                            ...feature.properties,
                            nom_commune: commune.nom_commune,
                            code_postal: commune.code_postal,
                            libelle_acheminement: commune.libelle_acheminement
                        }
                    };
                    results.push(enrichedFeature);
                }
            }
        }
    }

    return results;
}

function renderResults(matches, searchMode = 'postal') {
    listDiv.innerHTML = '';
    selectedFeatures = [];

    if (!matches.length) {
        listDiv.innerHTML = '<div>Aucun résultat trouvé</div>';
        downloadBtn.disabled = true;
        addSelectedBtn.disabled = true;
        addAllBtn.disabled = true;
        selectAllBtn.disabled = true;
        selectNoneBtn.disabled = true;
        updateSelectionInfo();
        return;
    }

    // Initial map display - will be updated by updateMapHighlight
    updateMapHighlight();
    map.fitBounds(L.geoJSON(matches).getBounds());

    // Create result list with checkboxes
    matches.forEach((f, index) => {
        const div = document.createElement('div');
        div.className = 'commune';

        const name = f.properties.nom_commune || f.properties.nom || f.properties.NOM || 'Commune inconnue';
        const postalCode = f.properties.code_postal || 'N/A';
        const insee = f.properties.code || 'N/A';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'commune-checkbox';
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!selectedFeatures.find(sf => sf.properties.code === f.properties.code)) {
                    selectedFeatures.push(f);
                    div.classList.add('selected');
                }
            } else {
                selectedFeatures = selectedFeatures.filter(sf => sf.properties.code !== f.properties.code);
                div.classList.remove('selected');
            }
            updateSelectionInfo();
        });

        const content = document.createElement('div');
        content.className = 'commune-content';
        content.innerHTML = `
          <div class="commune-name">${name}</div>
          <div class="commune-details">
            Code postal: ${postalCode} | INSEE: ${insee}
          </div>
        `;

        content.onclick = () => {
            map.fitBounds(L.geoJSON(f).getBounds());
        };

        div.appendChild(content);
        div.appendChild(checkbox);
        listDiv.appendChild(div);
    });

    downloadBtn.disabled = false;
    addAllBtn.disabled = false;
    selectAllBtn.disabled = false;
    updateSelectionInfo();
}

function clearResults() {
    lastMatches = [];
    selectedFeatures = [];
    listDiv.innerHTML = '';
    highlightLayer.clearLayers();
    selectedLayer.clearLayers();
    downloadBtn.disabled = true;
    addSelectedBtn.disabled = true;
    addAllBtn.disabled = true;
    selectAllBtn.disabled = true;
    selectNoneBtn.disabled = true;
    updateSelectionInfo();
}

function doSearch() {
    const codes = parseInput(postcodeInput.value);
    if (!codes.length) {
        alert('Entrez au moins un code postal');
        return;
    }

    showStatus('Recherche en cours...');

    if (currentSearchMode === 'postal') {
        // Search using CSV data
        lastMatches = findCommunesByPostalCode(codes);
        renderResults(lastMatches, 'postal');
    } else {
        // Direct search in GeoJSON
        const prop = propSelect.value;
        lastMatches = allFeatures.filter(f => matchFeature(f, prop, codes));
        renderResults(lastMatches, 'direct');
    }

    if (lastMatches.length > 0) {
        showStatus(`${lastMatches.length} commune(s) trouvée(s)`, 'success');
    } else {
        showStatus('Aucune commune trouvée', 'error');
    }
}

// Event listeners
searchBtn.onclick = doSearch;
postcodeInput.onkeydown = e => {
    if (e.key === 'Enter') doSearch();
};

downloadBtn.onclick = () => {
    const featuresToDownload = selectedFeatures.length > 0 ? selectedFeatures : lastMatches;
    if (!featuresToDownload.length) {
        alert('Aucune commune à télécharger');
        return;
    }
    const fc = {type: 'FeatureCollection', features: featuresToDownload};
    const blob = new Blob([JSON.stringify(fc, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `communes_${selectedFeatures.length > 0 ? 'selectionnees' : 'resultats'}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
};

addSelectedBtn.onclick = () => {
    if (!selectedFeatures.length) {
        alert('Aucune commune sélectionnée');
        return;
    }
    // Avoid duplicates by checking INSEE codes
    const existingCodes = new Set(groupFeatures.map(f => f.properties.code));
    const newFeatures = selectedFeatures.filter(f => !existingCodes.has(f.properties.code));

    groupFeatures.push(...newFeatures);
    updateGroupLayer();
    showStatus(`${newFeatures.length} commune(s) ajoutée(s) au groupe`, 'success');
};

addAllBtn.onclick = () => {
    if (!lastMatches.length) {
        alert('Aucun résultat à ajouter');
        return;
    }
    // Avoid duplicates by checking INSEE codes
    const existingCodes = new Set(groupFeatures.map(f => f.properties.code));
    const newFeatures = lastMatches.filter(f => !existingCodes.has(f.properties.code));

    groupFeatures.push(...newFeatures);
    updateGroupLayer();
    showStatus(`${newFeatures.length} commune(s) ajoutée(s) au groupe`, 'success');
};

selectAllBtn.onclick = () => {
    selectedFeatures = [...lastMatches];
    // Update checkboxes and visual state
    const checkboxes = document.querySelectorAll('.commune-checkbox');
    const communes = document.querySelectorAll('.commune');
    checkboxes.forEach((cb, i) => {
        cb.checked = true;
        communes[i].classList.add('selected');
    });
    updateSelectionInfo();
};

selectNoneBtn.onclick = () => {
    selectedFeatures = [];
    // Update checkboxes and visual state
    const checkboxes = document.querySelectorAll('.commune-checkbox');
    const communes = document.querySelectorAll('.commune');
    checkboxes.forEach((cb, i) => {
        cb.checked = false;
        communes[i].classList.remove('selected');
    });
    updateSelectionInfo();
};

clearGroupBtn.onclick = () => {
    groupFeatures = [];
    updateGroupLayer();
    showStatus('Groupe vidé', 'success');
};

function updateGroupLayer() {
    groupLayer.clearLayers();
    if (!groupFeatures.length) {
        clearGroupBtn.disabled = true;
        updateCoordsOutput();
        return;
    }

    const fc = {type: 'FeatureCollection', features: groupFeatures};
    L.geoJSON(fc, {
        style: {color: '#16a34a', weight: 2, fillOpacity: 0.1}
    }).addTo(groupLayer);

    clearGroupBtn.disabled = false;
    updateCoordsOutput();
}