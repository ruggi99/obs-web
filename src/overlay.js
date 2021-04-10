// Import OBS-websocket
import OBSWebSocket from 'obs-websocket-js';
const obs = new OBSWebSocket();

import './overlay.css';

var parent = undefined;
var parentP = undefined;
var title = undefined;
var subtitle = undefined;

var timeoutVisible = false;

addEventListener('load', async function () {
  obs.connect({ address: 'localhost:4444' });
  document.body.appendChild(document.createElement('div'));
  parent = document.createElement('div');
  parent.className = 'parent';
  title = document.createElement('div');
  title.className = 'title';
  subtitle = document.createElement('div');
  subtitle.className = 'subtitle';
  document.body.appendChild(parent);
  parent.appendChild(title);
  parent.appendChild(subtitle);
  title.textContent = 'Title';
  subtitle.textContent = 'SottoTitolo';
  document.title = 'Overlay';
  parentP = document.createElement('div');
  parentP.className = 'parentP';
  for (var i = 0; i < 2; i++) {
    var child = document.createElement('div');
    parentP.appendChild(child);
    for (var j = 0; j < 4; j++) {
      var child2 = document.createElement('div');
      child.appendChild(child2);
    }
  }
  document.body.appendChild(parentP);
});

function toggleVisibility(val) {
  parent.classList.toggle('visible', (timeoutVisible = val));
  obs.send('BroadcastCustomMessage', { realm: 'overlay', data: { visible: val } });
}

function caricaGiocatore(player) {
  return `#${player.jersey} ${capitalize(player.name) || ''}`;
}

function caricaGiocatore2(points) {
  return `${points.punti} ${capitalize(points.surname + ' ' + points.firstname)}`;
}

function createChunk(players, quantity) {
  return Array(Math.ceil(players.length / quantity))
    .fill()
    .map((_, index) => index * quantity)
    .map((begin) => players.slice(begin, begin + quantity));
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function capitalize(str) {
  if (str.indexOf(' ') == -1) return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  str = str.split(' ');
  str = str.map((val) => capitalize(val));
  return str.join(' ');
}

async function timeout(data) {
  if (timeoutVisible) {
    // Transizione di chiusura
    toggleVisibility(false);
  } else {
    // Transizione di apertura
    title.textContent = 'Timeout';
    subtitle.textContent = data.who;
    //parent.classList.toggle('toRight', (toRight = !toRight));
    toggleVisibility(true);
  }
}

async function battuta(data) {
  title.textContent = 'Battuta';
  subtitle.textContent = caricaGiocatore(data.player);
  //parent.classList.toggle('toRight', (toRight = !toRight));
  toggleVisibility(true);
  await sleep(5000);
  toggleVisibility(false);
}

async function ace(data) {
  title.textContent = 'Ace';
  subtitle.textContent = caricaGiocatore(data.player);
  toggleVisibility(true);
  await sleep(5000);
  toggleVisibility(false);
}

async function muro(data) {
  title.textContent = 'Muro';
  subtitle.textContent = caricaGiocatore(data.player);
  toggleVisibility(true);
  await sleep(5000);
  toggleVisibility(false);
}

async function custom(data) {
  title.textContent = data.title;
  subtitle.textContent = capitalize(data.subtitle);
  toggleVisibility(true);
}

async function reset(data) {
  toggleVisibility(false);
}

async function punti(data) {
  if (!data.points.length) return;
  var points = createChunk(data.points, 4);
  for (var i = 0; i < 2; i++) {
    for (var j = 0; j < 4; j++) {
      parentP.children[i].children[j].textContent = '';
      parentP.children[i].children[j].className = '';
    }
  }
  for (var i = 0; i < Math.min(points.length, 2); i++) {
    for (var j = 0; j < points[i].length; j++) {
      parentP.children[i].children[j].textContent = caricaGiocatore2(points[i][j]);
      if (points[i][j].disp_name2 == 'Bolghera') {
        parentP.children[i].children[j].className = 'bold';
      }
    }
  }
  parentP.classList.add('visible');
  await sleep(5000);
  parentP.classList.add('secondo');
  await sleep(5000);
  parentP.classList.remove('visible');
  await sleep(1000);
  parentP.classList.remove('secondo');
}

obs.on('BroadcastCustomMessage', async (data) => {
  if (data.realm != 'overlayer') return;
  data = data.data;
  switch (data.type) {
    case 'timeout':
      return await timeout(data);
    case 'battuta':
      return await battuta(data);
    case 'ace':
      return await ace(data);
    case 'muro':
      return await muro(data);
    case 'custom':
      return await custom(data);
    case 'reset':
      return await reset(data);
    case 'punti':
      return await punti(data);
  }
});

//setTimeout(showPunti, 2000);

//setTimeout(showPunti, 10 * 60 * 1000); // 10 minuti
