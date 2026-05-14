// 🔑 CONFIG
const SUPABASE_URL = "https://iyydygckanaydzbjkjwr.supabase.co/rest/v1/container?select=*";
const API_KEY = "sb_publishable_fHPmub9Khy8ZWhGEvYq7Fg_KPMwAlrC";

// =========================
// 🗺️ MAPA
// =========================
const map = L.map('map', {
  zoomControl: false
}).setView([-23.47, -47.44], 13);

L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution: '© OpenStreetMap'
  }
).addTo(map);

// =========================
// 📦 ESTADO
// =========================
let markers = [];
let containersData = [];
let minhaPosicao = null;
let rotaControle = null;
let marcadorUsuario = null;
let watchId = null;

// =========================
// 📍 ÍCONE USUÁRIO
// =========================
const iconeUsuario = L.divIcon({
  className: '',
  html: `<div class="usuario-marker"></div>`,
  iconSize: [30, 30]
});

// =========================
// 🔄 CARREGAR LIXEIRAS
// =========================
async function carregarContainers() {

  try {

    const response = await fetch(
      SUPABASE_URL,
      {
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`
        }
      }
    );

    const data = await response.json();

    containersData = data;

    markers.forEach(m => map.removeLayer(m));

    markers = [];

    data.forEach(c => {

      const cheio =
        c.status === true ||
        c.status == 1;

      const marker = L.circleMarker(
        [c.latitude, c.longitude],
        {
          color: cheio ? '#ff3b30' : '#2ecc71',
          radius: 10,
          fillOpacity: 1
        }
      ).addTo(map);

      marker.bindPopup(`
        <b>${c.endereco}</b><br>
        ${cheio ? 'Cheio 🚨' : 'Disponível ✅'}
      `);

      markers.push(marker);
    });

  } catch (erro) {

    console.error(erro);

  }
}

// =========================
// 📏 DISTÂNCIA
// =========================
function calcularDistancia(lat1, lon1, lat2, lon2) {

  const R = 6371;

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =========================
// 📍 LOCALIZAÇÃO TEMPO REAL
// =========================
function iniciarGPS() {

  if (!navigator.geolocation) {
    alert('Geolocalização não suportada');
    return;
  }

  watchId = navigator.geolocation.watchPosition(

    pos => {

      minhaPosicao = [
        pos.coords.latitude,
        pos.coords.longitude
      ];

      // ROTAÇÃO BASEADA NA DIREÇÃO
      const heading = pos.coords.heading || 0;

      if (!marcadorUsuario) {

        marcadorUsuario = L.marker(
          minhaPosicao,
          {
            icon: iconeUsuario
          }
        ).addTo(map);

      } else {

        marcadorUsuario.setLatLng(minhaPosicao);

      }

      const elemento = document.querySelector('.usuario-marker');

      if (elemento) {
        elemento.style.transform = `rotate(${heading}deg)`;
      }

      map.setView(minhaPosicao, 17);

    },

    erro => {
      console.log(erro);
    },

    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    }
  );
}

// =========================
// 📍 MINHA LOCALIZAÇÃO
// =========================
function irParaMinhaLocalizacao() {

  if (minhaPosicao) {
    map.setView(minhaPosicao, 17);
  }
}

// =========================
// 🧭 LIXEIRA MAIS PRÓXIMA
// =========================
function rotaMaisProxima() {

  if (!minhaPosicao) {
    alert('Aguardando GPS...');
    return;
  }

  const cheios = containersData.filter(c =>
    c.status === true ||
    c.status == 1
  );

  if (cheios.length === 0) {
    alert('Nenhuma lixeira cheia');
    return;
  }

  let melhor = cheios[0];
  let menor = Infinity;

  cheios.forEach(c => {

    const d = calcularDistancia(
      minhaPosicao[0],
      minhaPosicao[1],
      c.latitude,
      c.longitude
    );

    if (d < menor) {
      menor = d;
      melhor = c;
    }
  });

  desenharRota(melhor);
}

// =========================
// 🗺️ ROTA ESTILO WAZE
// =========================
function desenharRota(destino) {

  if (rotaControle) {
    map.removeControl(rotaControle);
  }

  rotaControle = L.Routing.control({

    waypoints: [
      L.latLng(minhaPosicao[0], minhaPosicao[1]),
      L.latLng(destino.latitude, destino.longitude)
    ],

    addWaypoints: false,
    draggableWaypoints: false,
    routeWhileDragging: false,
    fitSelectedRoutes: true,
    showAlternatives: false,

    lineOptions: {
      styles: [
        {
          color: '#007aff',
          weight: 8,
          opacity: 0.9
        }
      ]
    },

    createMarker: function(i, wp) {

      if (i === 0) {

        return L.marker(
          wp.latLng,
          {
            icon: iconeUsuario
          }
        );
      }

      return L.marker(wp.latLng)
        .bindPopup('🗑️ Lixeira cheia');
    }

  }).addTo(map);

  rotaControle.on('routesfound', function(e) {

    const rota = e.routes[0];

    const resumo = rota.summary;

    const distanciaKm =
      (resumo.totalDistance / 1000)
      .toFixed(1);

    const tempoMin =
      Math.round(resumo.totalTime / 60);

    document.querySelector('.direcaoAtual').innerHTML =
      '🚛 Siga para a lixeira cheia';

    document.querySelector('.distanciaAtual').innerHTML =
      `${distanciaKm} km • ${tempoMin} min`;

  });
}

// =========================
// 🔄 ATUALIZAR
// =========================
function atualizarMapa() {
  carregarContainers();
}

// =========================
// 🚀 START
// =========================
carregarContainers();
iniciarGPS();

setInterval(carregarContainers, 5000);