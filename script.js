// 🔑 CONFIG
const SUPABASE_URL = "https://iyydygckanaydzbjkjwr.supabase.co/rest/v1/container?select=*";
const API_KEY = "sb_publishable_fHPmub9Khy8ZWhGEvYq7Fg_KPMwAlrC";

// 🗺️ MAPA
const map = L.map('map').setView([-23.47, -47.44], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

// 📦 ESTADO
let markers = [];
let containersData = [];
let minhaPosicao = null;
let rotaControle = null;

const LIMITE_COLETA = 5;

// =========================
// 🔄 CARREGAR CONTAINERS
// =========================
async function carregarContainers() {

  try {

    const response = await fetch(SUPABASE_URL, {
      headers: {
        "apikey": API_KEY,
        "Authorization": `Bearer ${API_KEY}`
      }
    });

    const data = await response.json();

    containersData = data;

    // REMOVE MARCADORES ANTIGOS
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    // ADICIONA NOVOS
    data.forEach(c => {

      const cheio = c.status === true || c.status == 1;

      const marker = L.circleMarker(
        [c.latitude, c.longitude],
        {
          color: cheio ? "red" : "green",
          radius: 10
        }
      ).addTo(map);

      marker.bindPopup(`
        <b>${c.endereco}</b><br>
        ${cheio ? "Cheio 🚨" : "Disponível ✅"}
      `);

      markers.push(marker);
    });

  } catch (erro) {

    console.error("Erro ao carregar containers:", erro);

  }
}

// =========================
// 📍 LOCALIZAÇÃO
// =========================
function irParaMinhaLocalizacao() {
  obterLocalizacao();
}

function obterLocalizacao(callback) {

  navigator.geolocation.getCurrentPosition(pos => {

    minhaPosicao = [
      pos.coords.latitude,
      pos.coords.longitude
    ];

    map.setView(minhaPosicao, 15);

    L.marker(minhaPosicao)
      .addTo(map)
      .bindPopup("📍 Você está aqui");

    if (callback) callback();

  }, () => {

    alert("Ative a localização 📍");

  });
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

  return 2 * R * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(1 - a)
  );
}

// =========================
// 🧠 PRIORIDADE
// =========================
function calcularPrioridade(c) {

  const nivel = c.nivel ?? 100;

  const dist = calcularDistancia(
    minhaPosicao[0],
    minhaPosicao[1],
    c.latitude,
    c.longitude
  );

  return nivel / (dist + 0.001);
}

// =========================
// 🔥 SELECIONAR LIXEIRAS
// =========================
function selecionarLixeiras() {

  const cheios = containersData.filter(c =>
    c.status === true || c.status == 1
  );

  cheios.sort((a, b) =>
    calcularPrioridade(b) - calcularPrioridade(a)
  );

  return cheios.slice(0, LIMITE_COLETA);
}

// =========================
// 🚛 OTIMIZAR ROTA
// =========================
function otimizarRota(lista) {

  let rota = [];

  let atual = {
    latitude: minhaPosicao[0],
    longitude: minhaPosicao[1]
  };

  let restantes = [...lista];

  while (restantes.length > 0) {

    let melhor = 0;
    let scoreMax = -Infinity;

    restantes.forEach((c, i) => {

      const dist = calcularDistancia(
        atual.latitude,
        atual.longitude,
        c.latitude,
        c.longitude
      );

      const score =
        (c.nivel ?? 100) / (dist + 0.001);

      if (score > scoreMax) {

        scoreMax = score;
        melhor = i;

      }
    });

    const prox = restantes.splice(melhor, 1)[0];

    rota.push(prox);

    atual = prox;
  }

  return rota;
}

// =========================
// 🌍 TRADUÇÃO GLOBAL
// =========================
function traduzirInstrucoes() {

  const elementos = document.querySelectorAll(
    '.leaflet-routing-container *'
  );

  elementos.forEach(el => {

    if (!el.innerHTML) return;

    let texto = el.innerHTML;

    // DIREÇÕES
    texto = texto.replaceAll("northwest", "noroeste");
    texto = texto.replaceAll("northeast", "nordeste");
    texto = texto.replaceAll("southwest", "sudoeste");
    texto = texto.replaceAll("southeast", "sudeste");

    texto = texto.replaceAll("north", "norte");
    texto = texto.replaceAll("south", "sul");
    texto = texto.replaceAll("east", "leste");
    texto = texto.replaceAll("west", "oeste");

    // MOVIMENTOS
    texto = texto.replaceAll("Head", "Siga");

    texto = texto.replaceAll(
      "Go straight",
      "Siga em frente"
    );

    texto = texto.replaceAll(
      "Make a sharp right",
      "Faça uma curva fechada à direita"
    );

    texto = texto.replaceAll(
      "Make a sharp left",
      "Faça uma curva fechada à esquerda"
    );

    texto = texto.replaceAll(
      "Make a U-turn and continue",
      "Faça um retorno e continue"
    );

    texto = texto.replaceAll(
      "Make a U-turn",
      "Faça um retorno"
    );

    texto = texto.replaceAll(
      "Turn right",
      "Vire à direita"
    );

    texto = texto.replaceAll(
      "Turn left",
      "Vire à esquerda"
    );

    texto = texto.replaceAll(
      "Continue straight",
      "Continue em frente"
    );

    texto = texto.replaceAll(
      "Continue left",
      "Continue à esquerda"
    );

    texto = texto.replaceAll(
      "Continue right",
      "Continue à direita"
    );

    // RODOVIAS
    texto = texto.replaceAll(
      "Merge left",
      "Entre à esquerda"
    );

    texto = texto.replaceAll(
      "Merge right",
      "Entre à direita"
    );

    texto = texto.replaceAll(
      "Take the ramp",
      "Pegue a saída"
    );

    texto = texto.replaceAll(
      "Keep left",
      "Mantenha-se à esquerda"
    );

    texto = texto.replaceAll(
      "Keep right",
      "Mantenha-se à direita"
    );

    // DESTINO
    texto = texto.replaceAll(
      "You have arrived at your destination, on the left",
      "Você chegou ao seu destino, à esquerda"
    );

    texto = texto.replaceAll(
      "You have arrived at your destination, on the right",
      "Você chegou ao seu destino, à direita"
    );

    // PREPOSIÇÕES
    texto = texto.replaceAll("onto", "na");
    texto = texto.replaceAll("toward", "em direção a");
    texto = texto.replaceAll("towards", "em direção a");

    // UNIDADES
    texto = texto.replaceAll("kilometers", "quilômetros");
    texto = texto.replaceAll("kilometer", "quilômetro");

    texto = texto.replaceAll("meters", "metros");
    texto = texto.replaceAll("meter", "metro");

    texto = texto.replaceAll("hours", "horas");
    texto = texto.replaceAll("hour", "hora");

    texto = texto.replaceAll("minutes", "minutos");
    texto = texto.replaceAll("minute", "minuto");

    el.innerHTML = texto;
  });
}

// =========================
// 🗺️ DESENHAR ROTA
// =========================
function desenharRota(rota) {

  // REMOVE ROTA ANTIGA
  if (rotaControle) {
    map.removeControl(rotaControle);
  }

  // WAYPOINTS
  const waypoints = [
    L.latLng(
      minhaPosicao[0],
      minhaPosicao[1]
    )
  ];

  rota.forEach(c => {

    waypoints.push(
      L.latLng(c.latitude, c.longitude)
    );

  });

  // ROTA
  rotaControle = L.Routing.control({

    waypoints: waypoints,

    showAlternatives: false,

    addWaypoints: false,

    draggableWaypoints: false,

    routeWhileDragging: false,

    fitSelectedRoutes: true,

    lineOptions: {
      styles: [
        {
          color: '#2ecc71',
          weight: 6
        },
        {
          color: '#27ae60',
          weight: 3
        }
      ]
    },

    formatter: new L.Routing.Formatter({
      language: 'pt-BR',
      units: 'metric'
    }),

    createMarker: function(i, wp) {

      if (i === 0) {

        return L.marker(wp.latLng)
          .bindPopup("🚀 Início");

      }

      if (i === waypoints.length - 1) {

        return L.marker(wp.latLng)
          .bindPopup("🏁 Destino");

      }

      return L.circleMarker(
        wp.latLng,
        {
          radius: 8,
          color: "orange"
        }
      ).bindPopup("🗑️ Coleta");
    }

  }).addTo(map);

  // 🔥 TRADUZIR NO VERCEL
  rotaControle.on('routesfound', function() {

    setTimeout(traduzirInstrucoes, 500);
    setTimeout(traduzirInstrucoes, 1000);
    setTimeout(traduzirInstrucoes, 2000);

  });
}

// =========================
// 🚛 COLETA INTELIGENTE
// =========================
function iniciarColetaInteligente() {

  if (!minhaPosicao) {

    obterLocalizacao(executar);

  } else {

    executar();

  }
}

function executar() {

  const selecionadas =
    selecionarLixeiras();

  const rota =
    otimizarRota(selecionadas);

  desenharRota(rota);
}

// =========================
// 🧭 MAIS PRÓXIMA
// =========================
function rotaMaisProxima() {

  if (!minhaPosicao) {

    obterLocalizacao(
      rotaMaisProxima
    );

    return;
  }

  const cheios =
    containersData.filter(c =>
      c.status === true || c.status == 1
    );

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

  desenharRota([melhor]);
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
setInterval(carregarContainers, 5000);

carregarContainers();