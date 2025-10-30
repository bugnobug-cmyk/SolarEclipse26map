// app.js (remplacement recommandé)
// - Détection automatique du préfixe (GitHub Pages project page support)
// - Préchargement des fichiers popup HTML dans un cache
// - Gestion des erreurs, validation lat/lng, filtrage par zone, clustering si dispo

(async function () {
  'use strict';

  // --- Configuration ---
  const DEFAULT_CENTER = [36.72, -4.42];
  const DEFAULT_ZOOM = 12;
  // Attention : points.json attendu dans data/points.json (relatif à index.html). Si tu veux un autre emplacement, adapte.
  const RELATIVE_POINTS_PATH = 'data/points.json';
  const MAX_POINTS_FOR_TEST = null; // mettre un nombre pour limiter pendant tests

  // --- Vérifications initiales ---
  if (typeof L === 'undefined') {
    console.error('Leaflet non chargé. Vérifie que <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script> est présent.');
    return;
  }
  const mapEl = document.getElementById('map');
  const zoneSelect = document.getElementById('zoneSelect');
  const resetBtn = document.getElementById('resetBtn');
  if (!mapEl) {
    console.error('Element #map introuvable dans la page.');
    return;
  }

  // --- Init map ---
  const map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // support pour marker cluster si présent
  let markersLayer;
  if (typeof L.markerClusterGroup === 'function') {
    try {
      markersLayer = L.markerClusterGroup({ chunkedLoading: true });
      map.addLayer(markersLayer);
    } catch (e) {
      console.warn('Erreur init markerClusterGroup, fallback to LayerGroup', e);
      markersLayer = L.layerGroup().addTo(map);
    }
  } else {
    markersLayer = L.layerGroup().addTo(map);
  }

  // --- utilitaires ---
  function isValidLatLng(lat, lng) {
    const a = parseFloat(lat), b = parseFloat(lng);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    if (a < -90 || a > 90 || b < -180 || b > 180) return false;
    return true;
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"'`]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[m];
    });
  }

  // Détecter préfixe base pour GitHub Pages project site
  // Si la page est servie sous /<repo>/..., on préfixe par /<repo>/ sinon on utilise './'
  const pathParts = location.pathname.split('/').filter(Boolean);
  // Remplacer 'carte-malaga' par le nom de ton repo si tu veux forcer, ici on essaie d'être agnostique
  const repoPrefixDetected = (pathParts.length > 0 && pathParts[0] !== ''); // true si un sous-chemin existe
  const base = repoPrefixDetected ? `/${pathParts[0]}/` : './';
  // Construire chemin final pour points.json
  const pointsPath = (RELATIVE_POINTS_PATH.startsWith('/') || RELATIVE_POINTS_PATH.match(/^https?:\/\//)) ? RELATIVE_POINTS_PATH : base + RELATIVE_POINTS_PATH;

  // --- chargement des points et des popups ---
  let allPoints = [];
  async function fetchTextSafe(url) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      console.warn('fetchTextSafe failed for', url, e);
      return null;
    }
  }

  async function loadPointsAndPopups() {
    try {
      const resp = await fetch(pointsPath, { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`points.json fetch failed: ${resp.status} ${resp.statusText}`);
      const data = await resp.json();
      if (!Array.isArray(data)) throw new Error('points.json doit être un tableau JSON');

      allPoints = MAX_POINTS_FOR_TEST ? data.slice(0, MAX_POINTS_FOR_TEST) : data;

      // Précharger les fichiers popup listés dans points (champ popupHtml attendu)
      const popupFiles = [...new Set(allPoints.map(p => p.popupHtml).filter(Boolean))];
      const popupCache = {};
      await Promise.all(popupFiles.map(async (relPath) => {
        // resolver path : si relPath commence par http/https ou / on l'utilise tel quel, sinon préfixe base
        const fetchPath = (/^(https?:)?\/\//.test(relPath) || relPath.startsWith('/')) ? relPath : base + relPath;
        const html = await fetchTextSafe(fetchPath);
        popupCache[relPath] = html || `<div>Impossible de charger le popup: ${escapeHtml(relPath)}</div>`;
      }));

      populateZoneSelect(allPoints);
      renderPoints(allPoints, popupCache);
    } catch (err) {
      console.error('Erreur chargement points/popup:', err);
      // Ajout d'un contrôle simple pour avertir
      const ctrl = L.control({position: 'topright'});
      ctrl.onAdd = () => {
        const el = L.DomUtil.create('div', 'load-error');
        el.style.background = 'rgba(255,200,200,0.9)';
        el.style.padding = '6px';
        el.style.borderRadius = '4px';
        el.innerHTML = '<b>Erreur chargement données</b><br>Regarde la console pour plus d\'infos.';
        return el;
      };
      ctrl.addTo(map);
    }
  }

  function renderPoints(points, popupCache = {}) {
    markersLayer.clearLayers();
    const validPoints = points.filter(p => isValidLatLng(p.lat, p.lng));
    if (validPoints.length === 0) {
      console.warn('Aucun point valide à afficher.');
      return;
    }
    validPoints.forEach(pt => {
      const lat = parseFloat(pt.lat), lng = parseFloat(pt.lng);
      const marker = L.marker([lat, lng]);
      let content = '';
      if (pt.inlineHtml) content = pt.inlineHtml;
      else if (pt.popupHtml && popupCache[pt.popupHtml]) content = popupCache[pt.popupHtml];
      else {
        // fallback : construire un petit popup depuis les propriétés
        const name = escapeHtml(pt.nom || pt.title || 'Sans nom');
        const zone = escapeHtml(pt.zone || '');
        const description = escapeHtml(pt.description || '');
        content = `<div style="min-width:180px"><strong>${name}</strong><br><em>Zone: ${zone}</em><p>${description}</p></div>`;
      }
      try {
        marker.bindPopup(content);
      } catch (e) {
        console.warn('bindPopup failed', e);
      }
      if (markersLayer.addLayer) markersLayer.addLayer(marker);
      else markersLayer.addTo(marker);
    });

    // Ajuster vue
    if (validPoints.length === 1) {
      map.setView([parseFloat(validPoints[0].lat), parseFloat(validPoints[0].lng)], 14);
    } else {
      const bounds = L.latLngBounds(validPoints.map(p => [parseFloat(p.lat), parseFloat(p.lng)]));
      map.fitBounds(bounds.pad(0.2));
    }
  }

  function populateZoneSelect(points) {
    if (!zoneSelect) return;
    zoneSelect.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = `Toutes les zones (${points.length})`;
    zoneSelect.appendChild(allOpt);

    const counts = points.reduce((acc, p) => {
      const z = (p.zone || '—').toString();
      acc[z] = (acc[z] || 0) + 1;
      return acc;
    }, {});
    const zones = Object.keys(counts).sort((a,b) => a.localeCompare(b, 'fr'));
    zones.forEach(z => {
      const o = document.createElement('option');
      o.value = z;
      o.textContent = `${z} (${counts[z]})`;
      zoneSelect.appendChild(o);
    });

    zoneSelect.addEventListener('change', () => {
      const v = zoneSelect.value;
      const filtered = v === 'all' ? allPoints : allPoints.filter(p => (p.zone || '').toString() === v);
      renderPoints(filtered);
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        zoneSelect.value = 'all';
        renderPoints(allPoints);
      });
    }
  }

  // Lancement
  loadPointsAndPopups();

})();
