// Import OBS-websocket
import OBSWebSocket from 'obs-websocket-js';
const obs = new OBSWebSocket();

import './overlay.css';

var parent = undefined;
var title = undefined;
var subtitle = undefined;

var timeoutVisible = false;
var toRight = false;

addEventListener('load', async function () {
  obs.connect({ address: 'localhost:4444' });
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
});

function toggleVisibility(val) {
  parent.classList.toggle('visible', (timeoutVisible = val));
  obs.send('BroadcastCustomMessage', { realm: 'overlay', data: { visible: val } });
}

function caricaGiocatore(player) {
  return `#${player.jersey} ${capitalize(player.name) || ''}`;
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
  }
});
