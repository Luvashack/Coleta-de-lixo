// 🔑 CONFIG
const SUPABASE_URL = "https://iyydygckanaydzbjkjwr.supabase.co/rest/v1/container?select=*";
const API_KEY = "sb_publishable_fHPmub9Khy8ZWhGEvYq7Fg_KPMwAlrC";

// =========================
// 🇧🇷 TRADUÇÃO LEAFLET
// =========================
L.Routing.Localization['pt-BR'] = {

  directions: {
    N: 'norte',
    NE: 'nordeste',
    E: 'leste',
    SE: 'sudeste',
    S: 'sul',
    SW: 'sudoeste',
    W: 'oeste',
    NW: 'noroeste'
  },

  instructions: {

    Head: [
      'Siga {dir}',
      ' na {road}'
    ],

    Continue: [
      'Continue {dir}',
      ' na {road}'
    ],

    SlightRight: [
      'Faça uma curva leve à direita',
      ' na {road}'
    ],

    SlightLeft: [
      'Faça uma curva leve à esquerda',
      ' na {road}'
    ],

    Right: [
      'Vire à direita',
      ' na {road}'
    ],

    Left: [
      'Vire à esquerda',
      ' na {road}'
    ],

    SharpRight: [
      'Faça uma curva fechada à direita',
      ' na {road}'
    ],

    SharpLeft: [
      'Faça uma curva fechada à esquerda',
      ' na {road}'
    ],

    TurnAround: [
      'Faça um retorno'
    ],

    WaypointReached: [
      'Você chegou em um ponto da rota'
    ],

    Roundabout: [
      'Entre na rotatória'
    ],

    DestinationReached: [
      'Você chegou ao destino'
    ]
  },

  formatOrder: function(n) {
    return n + 'º';
  }

};



// =========================
// 🗺️ MAPA
// =========================
const map = L.map('map').setView(
  [-23.47, -47.44],
  13
);

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

const LIMITE_COLETA = 5;

// =========================
// 🔄 CARREGAR CONTAINERS
// =========================
async function carregarContainers() {

  try {

    const response = await fetch(
      SUPABASE_URL,
      {
        headers: {
          "apikey": API_KEY,
          "Authorization": `Bearer ${API_KEY}`
        }
      }
    );

    const data = await response.json();

    containersData = data;

    // REMOVE ANTIGOS
    markers.forEach(m =>
      map.removeLayer(m)
    );

    markers = [];

    // ADICIONA NOVOS
    data.forEach(c => {

      const cheio =
        c.status === true ||
        c.status == 1;

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

    console.error(
      "Erro ao carregar containers:",
      erro
    );

  }
}

// =========================
// 📍 LOCALIZAÇÃO
// =========================
function obterLocalizacao(callback) {

  navigator.geolocation.getCurrentPosition(

    pos => {

      minhaPosicao = [
        pos.coords.latitude,
        pos.coords.longitude
      ];

      map.setView(
        minhaPosicao,
        15
      );

      L.marker(minhaPosicao)
        .addTo(map)
        .bindPopup("📍 Você está aqui");

      if (callback) callback();

    },

    () => {

      alert(
        "Ative a localização 📍"
      );

    }

  );
}

function irParaMinhaLocalizacao() {
  obterLocalizacao();
}

// =========================
// 📏 DISTÂNCIA
// =========================
function calcularDistancia(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R = 6371;

  const dLat =
    (lat2 - lat1) *
    Math.PI / 180;

  const dLon =
    (lon2 - lon1) *
    Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );
}

// =========================
// 🧠 PRIORIDADE
// =========================
function calcularPrioridade(c) {

  const nivel =
    c.nivel ?? 100;

  const dist =
    calcularDistancia(
      minhaPosicao[0],
      minhaPosicao[1],
      c.latitude,
      c.longitude
    );

  return nivel / (dist + 0.001);
}

// =========================
// 🔥 SELECIONAR
// =========================
function selecionarLixeiras() {

  const cheios =
    containersData.filter(c =>
      c.status === true ||
      c.status == 1
    );

  cheios.sort((a, b) =>
    calcularPrioridade(b) -
    calcularPrioridade(a)
  );

  return cheios.slice(
    0,
    LIMITE_COLETA
  );
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

      const dist =
        calcularDistancia(
          atual.latitude,
          atual.longitude,
          c.latitude,
          c.longitude
        );

      const score =
        (c.nivel ?? 100) /
        (dist + 0.001);

      if (score > scoreMax) {

        scoreMax = score;
        melhor = i;

      }
    });

    const prox =
      restantes.splice(
        melhor,
        1
      )[0];

    rota.push(prox);

    atual = prox;
  }

  return rota;
}

// =========================
// 🗺️ DESENHAR ROTA
// =========================
function desenharRota(rota) {

  // REMOVE ROTA ANTIGA
  if (rotaControle) {
    map.removeControl(
      rotaControle
    );
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
      L.latLng(
        c.latitude,
        c.longitude
      )
    );

  });

  // CRIA ROTA
  rotaControle =
    L.Routing.control({

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

      formatter:
        new L.Routing.Formatter({

          language: 'pt-BR',

          units: 'metric'

        }),

      createMarker: function(i, wp) {

        // INÍCIO
        if (i === 0) {

          return L.marker(
            wp.latLng
          ).bindPopup(
            "🚀 Início"
          );

        }

        // DESTINO
        if (
          i ===
          waypoints.length - 1
        ) {

          return L.marker(
            wp.latLng
          ).bindPopup(
            "🏁 Destino"
          );

        }

        // COLETAS
        return L.circleMarker(
          wp.latLng,
          {
            radius: 8,
            color: "orange"
          }
        ).bindPopup(
          "🗑️ Coleta"
        );
      }

    }).addTo(map);
}

// =========================
// 🚛 COLETA INTELIGENTE
// =========================
function iniciarColetaInteligente() {

  if (!minhaPosicao) {

    obterLocalizacao(
      executar
    );

  } else {

    executar();

  }
}

function executar() {

  const selecionadas =
    selecionarLixeiras();

  const rota =
    otimizarRota(
      selecionadas
    );

  desenharRota(rota);
}

// =========================
// 📍 MAIS PRÓXIMA
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
      c.status === true ||
      c.status == 1
    );

  let melhor = cheios[0];
  let menor = Infinity;

  cheios.forEach(c => {

    const d =
      calcularDistancia(
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
// 🔄 AUTO UPDATE
// =========================
setInterval(
  carregarContainers,
  5000
);

// START
carregarContainers();
