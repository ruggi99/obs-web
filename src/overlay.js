// Import OBS-websocket
import OBSWebSocket from 'obs-websocket-js';
const obs = new OBSWebSocket();

import './overlay.css';

const N_GIOCATORI = 8;

var parent = undefined;
var parentP = undefined;
var title = undefined;
var subtitle = undefined;
var table = undefined;

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
  table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Punti</th><th>Giocatore</th></tr></thead><tbody></tbody>';
  parentP.appendChild(table);
  Array(N_GIOCATORI)
    .fill()
    .forEach(() => {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td></td><td></td>';
      table.tBodies[0].appendChild(tr);
    });
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
  return `${capitalize(points.surname + ' ' + points.firstname[0])}.`;
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
    toggleVisibility(true);
  }
}

async function battuta(data) {
  title.textContent = 'Battuta';
  subtitle.textContent = caricaGiocatore(data.player);
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
  subtitle.textContent = data.sq;
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
  data.points.slice(0, N_GIOCATORI).forEach(function (p, i) {
    this.children[i].children[0].textContent = p.punti;
    this.children[i].children[1].textContent = caricaGiocatore2(p);
    if (p.disp_name_2 == 'Bolghera') {
      this.children[i].children[1].className = 'bold';
    } else {
      this.children[i].children[1].className = '';
    }
  }, table.tBodies[0]);
  parentP.classList.add('visible');
  await sleep(8000);
  parentP.classList.remove('visible');
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
