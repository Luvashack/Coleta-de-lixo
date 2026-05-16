// 🔑 CONFIG
const SUPABASE_URL = "https://iyydygckanaydzbjkjwr.supabase.co/rest/v1/container?select=*";
const API_KEY = "sb_publishable_fHPmub9Khy8ZWhGEvYq7Fg_KPMwAlrC";

// =========================
// 🔊 VOZ
// =========================
let vozAtivada = false;

function ativarSom() {
  vozAtivada = true;
  falar('Assistente de voz ativado');
}

function falar(texto) {
  if (!vozAtivada) return;

  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = 'pt-BR';
  fala.rate = 1;

  speechSynthesis.speak(fala);
}

// =========================
// 🗺️ MAPA (2D PURO)
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
    const response = await fetch(SUPABASE_URL, {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`
      }
    });

    const data = await response.json();
    containersData = data;

    markers.forEach(m => map.removeLayer(m));
    markers = [];

    data.forEach(c => {

      const cheio = c.status === true || c.status == 1;

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
// 📏 DISTÂNCIA (HAVERSINE)
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
// 📍 GPS TEMPO REAL (CORRIGIDO)
// =========================
function iniciarGPS() {

  if (!navigator.geolocation) {
    alert('Geolocalização não suportada');
    return;
  }

  navigator.geolocation.watchPosition(

    pos => {

      minhaPosicao = [
        pos.coords.latitude,
        pos.coords.longitude
      ];

      if (!marcadorUsuario) {

        marcadorUsuario = L.marker(
          minhaPosicao,
          { icon: iconeUsuario }
        ).addTo(map);

      } else {
        marcadorUsuario.setLatLng(minhaPosicao);
      }

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
    falar('Centralizando localização');
  }
}

// =========================
// 🚛 ORDENAR POR DISTÂNCIA
// =========================
function organizarPorDistancia(lista) {

  return lista.sort((a, b) => {

    const distA = calcularDistancia(
      minhaPosicao[0], minhaPosicao[1],
      a.latitude, a.longitude
    );

    const distB = calcularDistancia(
      minhaPosicao[0], minhaPosicao[1],
      b.latitude, b.longitude
    );

    return distA - distB;
  });
}

// =========================
// 🚛 COLETA COMPLETA
// =========================
function iniciarColetaCompleta() {

  if (!minhaPosicao) {
    alert('Aguardando GPS...');
    return;
  }

  const cheias = containersData.filter(c =>
    c.status === true || c.status == 1
  );

  if (cheias.length === 0) {
    alert('Nenhuma lixeira disponível');
    return;
  }

  const rotaOrdenada = organizarPorDistancia(cheias);

  desenharRota(rotaOrdenada);

  falar('Iniciando coleta completa');
}

// =========================
// 🗺️ DESENHAR ROTA (2D)
// =========================
function desenharRota(lista) {

  if (rotaControle) {
    map.removeControl(rotaControle);
  }

  const waypoints = [
    L.latLng(minhaPosicao[0], minhaPosicao[1])
  ];

  lista.forEach(c => {
    waypoints.push(
      L.latLng(c.latitude, c.longitude)
    );
  });

  rotaControle = L.Routing.control({

    waypoints: waypoints,

    addWaypoints: false,
    draggableWaypoints: false,
    routeWhileDragging: false,
    fitSelectedRoutes: true,
    showAlternatives: false,

    lineOptions: {
      styles: [
        {
          color: '#007aff',
          weight: 6,
          opacity: 0.9
        }
      ]
    },

    createMarker: function(i, wp) {

      if (i === 0) {
        return L.marker(wp.latLng, { icon: iconeUsuario });
      }

      return L.circleMarker(wp.latLng, {
        radius: 8,
        color: 'orange'
      }).bindPopup('🗑️ Lixeira');
    }

  }).addTo(map);

  rotaControle.on('routesfound', function(e) {

    const rota = e.routes[0];
    const resumo = rota.summary;

    const distanciaKm =
      (resumo.totalDistance / 1000).toFixed(1);

    const tempoMin =
      Math.round(resumo.totalTime / 60);

    document.querySelector('.direcaoAtual').innerHTML =
      '🚛 Coleta completa iniciada';

    document.querySelector('.distanciaAtual').innerHTML =
      `${distanciaKm} km • ${tempoMin} min`;

    falar(`Rota criada com ${lista.length} lixeiras`);
  });
}

// =========================
// 🔄 ATUALIZAR
// =========================
function atualizarMapa() {
  carregarContainers();
  falar('Mapa atualizado');
}

// =========================
// 🚀 START
// =========================
carregarContainers();
iniciarGPS();
setInterval(carregarContainers, 5000);