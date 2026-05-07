// 🔑 CONFIG
const SUPABASE_URL = "https://iyydygckanaydzbjkjwr.supabase.co/rest/v1/container?select=*";
const API_KEY = "sb_publishable_fHPmub9Khy8ZWhGEvYq7Fg_KPMwAlrC";

// MAPA
const map = L.map('map').setView([-23.47, -47.44], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

// ESTADO
let markers = [];
let containersData = [];
let minhaPosicao = null;
let rotaControle = null;

const LIMITE_COLETA = 5;

// CARREGAR
async function carregarContainers() {

  const response = await fetch(SUPABASE_URL, {
    headers: {
      "apikey": API_KEY,
      "Authorization": `Bearer ${API_KEY}`
    }
  });

  const data = await response.json();
  containersData = data;

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  data.forEach(c => {

    const cheio = c.status === true || c.status == 1;

    const marker = L.circleMarker([c.latitude, c.longitude], {
      color: cheio ? "red" : "green",
      radius: 10
    }).addTo(map);

    marker.bindPopup(`${c.endereco}<br>${cheio ? "Cheio 🚨" : "Disponível"}`);

    markers.push(marker);
  });
}

// LOCALIZAÇÃO
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

    L.marker(minhaPosicao).addTo(map)
      .bindPopup("Você está aqui");

    if (callback) callback();

  });
}

// DISTÂNCIA
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat/2) ** 2 +
    Math.cos(lat1*Math.PI/180) *
    Math.cos(lat2*Math.PI/180) *
    Math.sin(dLon/2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// PRIORIDADE
function calcularPrioridade(c) {
  const nivel = c.nivel ?? 100;

  const dist = calcularDistancia(
    minhaPosicao[0], minhaPosicao[1],
    c.latitude, c.longitude
  );

  return nivel / (dist + 0.001);
}

// SELEÇÃO
function selecionarLixeiras() {

  const cheios = containersData.filter(c =>
    c.status === true || c.status == 1
  );

  cheios.sort((a, b) =>
    calcularPrioridade(b) - calcularPrioridade(a)
  );

  return cheios.slice(0, LIMITE_COLETA);
}

// OTIMIZAÇÃO
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
        atual.latitude, atual.longitude,
        c.latitude, c.longitude
      );

      const score = (c.nivel ?? 100) / (dist + 0.001);

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

// 🚛 ROTA ESTILO APP
function desenharRota(rota) {

  if (rotaControle) {
    map.removeControl(rotaControle);
  }

  const waypoints = [
    L.latLng(minhaPosicao[0], minhaPosicao[1])
  ];

  rota.forEach(c => {
    waypoints.push(L.latLng(c.latitude, c.longitude));
  });

  rotaControle = L.Routing.control({
  waypoints: waypoints,

  showAlternatives: false,
  addWaypoints: false,
  draggableWaypoints: false,

  lineOptions: {
    styles: [
      { color: '#2ecc71', weight: 6 },
      { color: '#27ae60', weight: 3 }
    ]
  },

  // 🔥 TRADUÇÃO AQUI
  formatter: new L.Routing.Formatter({
    language: 'pt-BR',
    units: 'metric'
  }),

  createMarker: function(i, wp) {

    if (i === 0) {
      return L.marker(wp.latLng).bindPopup("🚀 Início");
    }

    if (i === waypoints.length - 1) {
      return L.marker(wp.latLng).bindPopup("🏁 Destino");
    }

    return L.circleMarker(wp.latLng, {
      radius: 8,
      color: "orange"
    }).bindPopup("🗑️ Coleta");
  }

}).addTo(map);

  // INSTRUÇÕES (console por enquanto)
  rotaControle.on('routesfound', function() {

  setTimeout(() => {

    const instrucoes = document.querySelectorAll(
      '.leaflet-routing-container .leaflet-routing-alt h2, .leaflet-routing-container .leaflet-routing-alt td'
    );

    instrucoes.forEach(el => {

      let texto = el.innerHTML;

      // =========================
      // DIREÇÕES
      // =========================
      texto = texto.replaceAll("northwest", "noroeste");
      texto = texto.replaceAll("northeast", "nordeste");
      texto = texto.replaceAll("southwest", "sudoeste");
      texto = texto.replaceAll("southeast", "sudeste");

      texto = texto.replaceAll("north", "norte");
      texto = texto.replaceAll("south", "sul");
      texto = texto.replaceAll("east", "leste");
      texto = texto.replaceAll("west", "oeste");

      // =========================
      // AÇÕES PRINCIPAIS
      // =========================
      texto = texto.replaceAll("Head", "Siga");

      texto = texto.replaceAll(
        "Make a U-turn and continue",
        "Faça um retorno e continue"
      );

      texto = texto.replaceAll(
        "Make a U-turn",
        "Faça um retorno"
      );

      texto = texto.replaceAll(
        "Turn sharp right",
        "Vire fortemente à direita"
      );

      texto = texto.replaceAll(
        "Turn sharp left",
        "Vire fortemente à esquerda"
      );

      texto = texto.replaceAll(
        "Turn slight right",
        "Vire levemente à direita"
      );

      texto = texto.replaceAll(
        "Turn slight left",
        "Vire levemente à esquerda"
      );

      texto = texto.replaceAll(
        "Make a slight right to stay on",
        "Faça uma curva leve à direita para permanecer na"
      );

      texto = texto.replaceAll(
        "Make a slight left to stay on",
        "Faça uma curva leve à esquerda para permanecer na"
      );

      texto = texto.replaceAll(
        "Make a slight right",
        "Faça uma curva leve à direita"
      );

      texto = texto.replaceAll(
        "Make a slight left",
        "Faça uma curva leve à esquerda"
      );

      texto = texto.replaceAll(
        "Slight right",
        "Curva leve à direita"
      );

      texto = texto.replaceAll(
        "Slight left",
        "Curva leve à esquerda"
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
        "Continue left",
        "Continue à esquerda"
      );

      texto = texto.replaceAll(
        "Continue right",
        "Continue à direita"
      );

      texto = texto.replaceAll(
        "Continue straight",
        "Continue em frente"
      );

      texto = texto.replaceAll(
        "Continue",
        "Continue"
      );

      // =========================
      // RODOVIAS / ACESSOS
      // =========================
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
        "Take the ramp on the left",
        "Pegue a saída à esquerda"
      );

      texto = texto.replaceAll(
        "Take the ramp on the right",
        "Pegue a saída à direita"
      );

      texto = texto.replaceAll(
        "Exit",
        "Saída"
      );

      texto = texto.replaceAll(
        "Keep left",
        "Mantenha-se à esquerda"
      );

      texto = texto.replaceAll(
        "Keep right",
        "Mantenha-se à direita"
      );

      // =========================
      // ROTATÓRIAS
      // =========================
      texto = texto.replaceAll(
        "Enter the roundabout",
        "Entre na rotatória"
      );

      texto = texto.replaceAll(
        "At the roundabout",
        "Na rotatória"
      );

      texto = texto.replaceAll(
        "Take the 1st exit",
        "Pegue a 1ª saída"
      );

      texto = texto.replaceAll(
        "Take the 2nd exit",
        "Pegue a 2ª saída"
      );

      texto = texto.replaceAll(
        "Take the 3rd exit",
        "Pegue a 3ª saída"
      );

      texto = texto.replaceAll(
        "Take the 4th exit",
        "Pegue a 4ª saída"
      );

      texto = texto.replaceAll(
        "Take the 5th exit",
        "Pegue a 5ª saída"
      );

      texto = texto.replaceAll(
        "Roundabout",
        "Rotatória"
      );

      // =========================
      // DESTINO
      // =========================
      texto = texto.replaceAll(
        "You have arrived at your destination, on the left",
        "Você chegou ao seu destino, à esquerda"
      );

      texto = texto.replaceAll(
        "You have arrived at your destination, on the right",
        "Você chegou ao seu destino, à direita"
      );

      texto = texto.replaceAll(
        "You have arrived",
        "Você chegou"
      );

      texto = texto.replaceAll(
        "Destination",
        "Destino"
      );

      texto = texto.replaceAll(
        "Waypoint",
        "Parada"
      );

      // =========================
      // PREPOSIÇÕES
      // =========================
      texto = texto.replaceAll(
        "onto",
        "na"
      );

      texto = texto.replaceAll(
        "to stay on",
        "para permanecer na"
      );

      texto = texto.replaceAll(
        "toward",
        "em direção a"
      );

      texto = texto.replaceAll(
        "towards",
        "em direção a"
      );

      // =========================
      // UNIDADES
      // =========================
      texto = texto.replaceAll(
        "kilometers",
        "quilômetros"
      );

      texto = texto.replaceAll(
        "kilometer",
        "quilômetro"
      );

      texto = texto.replaceAll(
        "meters",
        "metros"
      );

      texto = texto.replaceAll(
        "meter",
        "metro"
      );

      texto = texto.replaceAll(
        "hours",
        "horas"
      );

      texto = texto.replaceAll(
        "hour",
        "hora"
      );

      texto = texto.replaceAll(
        "minutes",
        "minutos"
      );

      texto = texto.replaceAll(
        "minute",
        "minuto"
      );

      texto = texto.replaceAll(
        "seconds",
        "segundos"
      );

      texto = texto.replaceAll(
        "second",
        "segundo"
      );

      // =========================
      // OUTROS
      // =========================
      texto = texto.replaceAll(
        "and continue",
        "e continue"
      );

      texto = texto.replaceAll(
        "for",
        "por"
      );

      texto = texto.replaceAll(
        "via",
        "via"
      );

      texto = texto.replaceAll(
        "Make a sharp right",
        "Vire à direita"
      );


       texto = texto.replaceAll(
        "Go straight",
        "Siga reto"
      );

      el.innerHTML = texto;

    });

  }, 300);

});
}

// EXECUÇÃO
function iniciarColetaInteligente() {

  if (!minhaPosicao) {
    obterLocalizacao(executar);
  } else {
    executar();
  }
}

function executar() {
  const rota = otimizarRota(selecionarLixeiras());
  desenharRota(rota);
}

// MAIS PRÓXIMA
function rotaMaisProxima() {

  if (!minhaPosicao) {
    obterLocalizacao(rotaMaisProxima);
    return;
  }

  const cheios = containersData.filter(c =>
    c.status === true || c.status == 1
  );

  let melhor = cheios[0];
  let menor = Infinity;

  cheios.forEach(c => {
    const d = calcularDistancia(
      minhaPosicao[0], minhaPosicao[1],
      c.latitude, c.longitude
    );

    if (d < menor) {
      menor = d;
      melhor = c;
    }
  });

  desenharRota([melhor]);
}

// INIT
setInterval(carregarContainers, 5000);
carregarContainers();