<script>
  export let obs;
  export let currentScene;
  export let sceneChunks;
  export let currentPreviewScene;
  export let isStudioMode;
  export let setPreview;
  export let setScene;
  // Imports
  import { onMount } from 'svelte';
  import { mdiRewind } from '@mdi/js';
  import Icon from 'mdi-svelte';

  import Effetti from './Effetti.svelte';
  import Mics from './Mics.svelte';

  onMount(async () => {
    await load();
    Array.from(document.querySelectorAll('.modal-background, .modal-close')).forEach((el) => el.addEventListener('click', () => cancelModal()));
  });

  // State
  let activeTab = 0;

  let nameSquadra1 = '',
    nameSquadra2 = '';
  let match = {};

  let playersSquadra1 = [],
    playersSquadra2 = [];
  let points = [];

  let battutaSquadra1 = undefined,
    battutaSquadra2 = undefined;

  let lastFetchTime = 0;
  let forceManual = true;
  let manualeButton = false;
  let modalOpened1 = false;
  let modalOpened2 = false;
  let title = '';
  let subtitle = '';
  let lastSelectedId = 0;
  let popupVisible = false;
  let defaultClasses = 'tile is-child column notification is-size-3 is-size-4-mobile has-text-centered ';
  $: manuale = forceManual || manualeButton;
  $: playersSquadra1C = createChunk(
    playersSquadra1.filter((pl) => pl.ptr.visible).sort((a, b) => a.jersey - b.jersey),
    3,
  );
  $: playersSquadra2C = createChunk(
    playersSquadra2.filter((pl) => pl.ptr.visible).sort((a, b) => a.jersey - b.jersey),
    3,
  );

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function load() {
    var res = await fetch('match.php')
      .then((r) => r.json())
      .catch(() => {});
    if (!res.match) return;
    match = res.match;
    var names = await fetch('names.json')
      .then((r) => r.json())
      .catch((e) => []);
    if (match.length !== 0) {
      var squadra1 = match.incasa ? match.hteam : match.vteam;
      var squadra2 = match.incasa ? match.vteam : match.hteam;
      var idSquadra1 = squadra1.id;
      var idSquadra2 = squadra2.id;
      nameSquadra1 = names[idSquadra1] || squadra1.disp_name;
      nameSquadra2 = names[idSquadra2] || squadra2.disp_name;
      playersSquadra1 = match.incasa ? res.players_h.people : res.players_v.people;
      playersSquadra2 = match.incasa ? res.players_v.people : res.players_h.people;
      playersSquadra1 = playersSquadra1.filter((p) => p.ptr.is_player);
      playersSquadra2 = playersSquadra2.filter((p) => p.ptr.is_player);
      await fixBrowsers(names);
      await rotations();
      setInterval(showPoints, 5 * 60 * 1000); // 5 minuti
    }
  }

  async function fixBrowsers(names) {
    var nameCasa = names[match.hteam_id] || match.hteam.disp_name2;
    var nameOspiti = names[match.vteam_id] || match.vteam.disp_name2;
    let punteggio = `https://srv.matchshare.it/stats_test/rest_api/overlay?mid=${match.id}&client_name=volleynetworkitalia&bg=0&uid=613`;
    let punteggioesteso = `https://srv.matchshare.it/stats_test/rest_api/overlay3?mid=${match.id}&client_name=volleynetworkitalia&bg=0`;
    let roster = `https://srv.matchshare.it/stats_test/rest_api/overlay2?mid=${match.id}&client_name=volleynetworkitalia`;
    let punti = `https://srv.matchshare.it/stats_test/rest_api/overlay7?mid=${match.id}&client_name=volleynetworkitalia`;
    var punteggiocss = `body {background-color: rgba(0, 0, 0, 0); margin: 20px; overflow: hidden;}
  table {overflow: hidden; background: rgba(255, 128, 0, 0.75); border-color: white;}
  .logos {display: none;}
  .hteam, .vteam {border-left: none; text-align: left;}
  td {color: white !important; border-color: white;}
  td:nth-child(-n+3) { background-color: rgba(0, 0, 0, 0.20); }
  .hteam, .vteam {color: transparent !important; width: 140px;}
  .hteam::before, .vteam::before {color: white; position: absolute;}
  .hteam::before {content: "${nameCasa}";}
  .vteam::before {content: "${nameOspiti}";}`;
    var punteggioestesocss = `body { background-color: rgba(0, 0, 0, 0); margin: 20px; overflow: hidden; }
  table { overflow: hidden; background: rgba(0, 0, 0, 0.75);}
  .logos {display: none;}
  .hteam, .vteam {border-left: none; text-align: left;}
  td {color: white !important;}
  td:nth-child(-n+3) {background-color: rgba(0, 0, 0, 1);}
  table { --color: rgb(238, 85, 46);}
  table {border-color: var(--color);}
  td { border-color: var(--color);}
  .hteam, .vteam {color: transparent !important;}
  .hteam::before, .vteam::before {color: white; position: absolute;}
  .hteam::before {content: "${nameCasa}";}
  .vteam::before {content: "${nameOspiti}";}`;
    await obs.send('SetSourceSettings', { sourceName: 'Punteggio', sourceSettings: { url: punteggio, css: punteggiocss } }).catch((_) => false);
    await obs.send('SetSourceSettings', { sourceName: 'Punteggio esteso', sourceSettings: { url: punteggioesteso, css: punteggioestesocss } }).catch((_) => false);
    await obs.send('SetSourceSettings', { sourceName: 'RosterB', sourceSettings: { url: roster } }).catch((_) => false);
    await obs.send('SetSourceSettings', { sourceName: 'PuntiB', sourceSettings: { url: punti } }).catch((_) => false);
  }

  function createChunk(players, quantity) {
    return Array(Math.ceil(players.length / quantity))
      .fill()
      .map((_, index) => index * quantity)
      .map((begin) => players.slice(begin, begin + quantity));
  }

  async function rotations() {
    var live = await fetch(`match_live.php?mid=${match.id}`)
      .then((r) => r.json())
      .catch(() => ({}));
    var rotation = live.rotation;
    if (rotation && rotation.length !== 0) {
      battutaSquadra1 = playersSquadra1.find((pl) => pl.id == rotation.idh1 || pl.id == rotation.idv1);
      battutaSquadra2 = playersSquadra2.find((pl) => pl.id == rotation.idh1 || pl.id == rotation.idv1);
      // Potrei non avere il roster, ma comunque avere il giocatore in battuta
      if (!battutaSquadra1) {
        var temp = match.incasa ? rotation.h1.split(' ') : rotation.v1.split(' ');
        var id = match.incasa ? rotation.idh1 : rotation.idv1;
        battutaSquadra1 = { surname: temp[1], name: temp[1], id: id, jersey: temp[0], ptr: { visible: true } };
        playersSquadra1 = [...playersSquadra1, battutaSquadra1];
      }
      if (!battutaSquadra2) {
        var temp = match.incasa ? rotation.v1.split(' ') : rotation.h1.split(' ');
        var id = match.incasa ? rotation.idv1 : rotation.idh1;
        battutaSquadra2 = { surname: temp[1], name: temp[1], id: id, jersey: temp[0], ptr: { visible: true } };
        playersSquadra2 = [...playersSquadra2, battutaSquadra2];
      }
      forceManual = false;
      points = live.points;
    } else {
      console.log('Rotazione vuota');
      forceManual = true;
    }
    if (!production) return;
    await schedule_next(rotations, 5000);
  }

  async function schedule_next(fn, tm) {
    var time = 2 * tm - (new Date().getTime() - lastFetchTime);
    time = Math.max(time, 0);
    time = Math.min(time, tm);
    lastFetchTime = new Date().getTime();
    setTimeout(fn, time);
  }

  async function showPoints() {
    if (points.length && currentScene == '5) Stream Points') {
      obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'punti', points: points } });
    } else {
      console.log('no points');
    }
  }

  async function openModal1() {
    modalOpened1 = true;
  }

  async function openModal2() {
    modalOpened2 = true;
  }

  async function openModal(sq1) {
    sq1 ? openModal1() : openModal2();
    document.documentElement.classList.add('is-clipped');
  }

  async function closeModal() {
    console.log(modalOpened1, modalOpened2);
    if (!modalOpened1 && !modalOpened2) return;
    modalOpened1 = false;
    modalOpened2 = false;
    document.documentElement.classList.remove('is-clipped');
    var ev = new CustomEvent('modal-closed');
    dispatchEvent(ev);
  }

  async function cancelModal() {
    console.log(modalOpened1, modalOpened2);
    if (!modalOpened1 && !modalOpened2) return;
    modalOpened1 = false;
    modalOpened2 = false;
    document.documentElement.classList.remove('is-clipped');
    var ev = new CustomEvent('modal-cancelled');
    dispatchEvent(ev);
  }

  async function modalClosed() {
    return new Promise(function (resolve, reject) {
      addEventListener('modal-closed', () => resolve(true), { once: true });
      addEventListener('modal-cancelled', () => resolve(false), { once: true });
    });
  }

  async function handleGiocatore(e) {
    lastSelectedId = e.currentTarget.dataset.id;
    console.log(lastSelectedId);
    await closeModal();
  }

  async function caricaGiocatore(sq1) {
    openModal(sq1);
    console.log('waiting for it');
    var res = await modalClosed();
    console.log('Modal chiuso');
    if (!res) return;
    var player = playersSquadra1.concat(playersSquadra2).find((pl) => pl.id == lastSelectedId);
    subtitle = `#${player.jersey} ${player.name}`;
  }

  function startReplay() {
    obs.send('TriggerHotkeyBySequence', { keyId: 'OBS_KEY_S', keyModifiers: { shift: true, control: true } });
  }

  function replay() {
    startReplay();
  }

  async function showTimeout(sq1) {
    var name = sq1 ? nameSquadra1 : nameSquadra2;
    obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'timeout', who: name } });
    await sleep(30000);
    resetPopup();
  }

  async function showBattuta(sq1) {
    if (manuale) {
      openModal(sq1);
      var res = await modalClosed();
      if (!res) return;
      var player = playersSquadra1.concat(playersSquadra2).find((pl) => pl.id == lastSelectedId);
    } else {
      var player = sq1 ? battutaSquadra1 : battutaSquadra2;
    }
    obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'battuta', player: player } });
    console.log(lastSelectedId, player);
  }

  async function showAce(sq1) {
    playEffect('Ace');
    if (manuale) {
      openModal(sq1);
      var res = await modalClosed();
      if (!res) return;
      var player = playersSquadra1.concat(playersSquadra2).find((pl) => pl.id == lastSelectedId);
    } else {
      var player = sq1 ? battutaSquadra1 : battutaSquadra2;
    }
    obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'ace', player: player } });
    console.log(lastSelectedId, player);
  }

  async function showMuro(sq1) {
    var option = Math.floor(Math.random() * 4);
    switch (option) {
      case 0:
        playEffect('Hazzard');
        break;
      case 1:
        playEffect('Monster Block');
        break;
      case 2:
        startReplay();
        break;
      case 3:
        playEffect('Hazzard');
        startReplay();
        break;
    }
    openModal(sq1);
    var res = await modalClosed();
    if (!res) return;
    var player = playersSquadra1.concat(playersSquadra2).find((pl) => pl.id == lastSelectedId);
    obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'muro', player: player } });
    console.log(lastSelectedId, player);
  }

  async function showCrediti() {
    await obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'custom', title: 'Telecronaca', subtitle: 'Alessandro Blasio' } });
    await sleep(5000);
    await obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'reset' } });
    await sleep(600);
    await obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'custom', title: 'Regia', subtitle: 'Ruggero Tomaselli' } });
    await sleep(5000);
    await obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'reset' } });
    await sleep(600);
    await obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'custom', title: 'Grafica', subtitle: 'Giorgia Perotti' } });
    await sleep(5000);
    await obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'reset' } });
  }

  async function customPopup() {
    obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'custom', title: title, subtitle: subtitle } });
  }

  async function resetPopup() {
    obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'reset' } });
  }

  async function playEffect(sourceName) {
    await obs.send('SetSceneItemProperties', { item: sourceName, 'scene-name': 'Effetti (hidden)', visible: true });
  }

  obs.on('BroadcastCustomMessage', async (data) => {
    if (data.realm != 'overlay') return;
    popupVisible = data.data.visible;
  });
</script>

<div class="modal" class:is-active={modalOpened1}>
  <div class="modal-background" />
  <div class="modal-content">
    <div class="box">
      {#each playersSquadra1C as chunk}
        <div class="tile is-ancestor">
          {#each chunk as pl}
            <div class="tile is-parent">
              <a on:click={handleGiocatore} class:is-warning={pl.role_1 == 4} class={defaultClasses + 'is-info'} data-id={pl.id}>
                <p class="subtitle has-text-centered is-size-6-mobile">#{pl.jersey} {pl.surname}</p>
              </a>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
  <button class="modal-close is-large" aria-label="close" />
</div>
<div class="modal" class:is-active={modalOpened2}>
  <div class="modal-background" />
  <div class="modal-content">
    <div class="box">
      {#each playersSquadra2C as chunk}
        <div class="tile is-ancestor">
          {#each chunk as pl}
            <div class="tile is-parent">
              <a on:click={handleGiocatore} class:is-warning={pl.role_1 == 4} class={defaultClasses + 'is-info'} data-id={pl.id}>
                <p class="subtitle has-text-centered is-size-6-mobile">#{pl.jersey} {pl.surname}</p>
              </a>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
  <button class="modal-close is-large" aria-label="close" />
</div>
<div style="display:flex; height: 100%;">
  <div style="flex: 0 0 auto">
    <ul class="tab">
      {#each ['Sce', 'Mic', 'Gra', 'Eff', 'Pop'] as text, i}
        <li class="tab-item" class:is-active={activeTab == i}>
          <a
            on:click={function (e) {
              activeTab = i;
            }}><span>{text}</span></a
          >
        </li>
      {/each}
    </ul>
  </div>
  <section class="section">
    <div class="container">
      {#if activeTab == 0}
        {#each sceneChunks as chunk}
          <div class="tile is-ancestor">
            {#each chunk as sc}
              <div class="tile is-parent">
                <!-- svelte-ignore a11y-missing-attribute -->
                {#if currentScene == sc.name}
                  <a class="tile is-child is-primary notification">
                    <p class="title has-text-centered is-size-6-mobile">{sc.name}</p>
                  </a>
                {:else if currentPreviewScene == sc.name}
                  <a on:click={setScene} class="tile is-child is-warning notification">
                    <p class="title has-text-centered is-size-6-mobile">{sc.name}</p>
                  </a>
                {:else}
                  <a on:click={isStudioMode ? setPreview : setScene} class="tile is-child is-danger notification">
                    <p class="title has-text-centered is-size-6-mobile">{sc.name}</p>
                  </a>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      {/if}
      <Mics {obs} visible={activeTab == 1} />
      {#if activeTab == 2}
        <div class="tile is-ancestor">
          <div class="tile is-parent">
            <a on:click={replay} class={defaultClasses + 'is-info'} class:is-success={currentScene?.includes('Replay')}>
              <span class="icon">
                <Icon path={mdiRewind} />
              </span>
              <span> Replay </span>
            </a>
          </div>
        </div>
        <div class="tile is-ancestor">
          <div class="tile is-parent">
            <a on:click={() => showTimeout(true)} class={defaultClasses + 'is-info'}>
              Timeout {nameSquadra1}
            </a>
          </div>
          <div class="tile is-parent">
            <a on:click={() => showTimeout(false)} class={defaultClasses + 'is-info'}>
              Timeout {nameSquadra2}
            </a>
          </div>
        </div>
        <div class="tile is-ancestor">
          <div class="tile is-parent">
            <a on:click={() => (manualeButton = !manualeButton)} class:is-warning={manuale} class={defaultClasses + 'is-info'} disabled={forceManual}>
              {manuale ? 'Manuale' + (forceManual ? ' (forzato)' : '') : 'Automatico'}
            </a>
          </div>
        </div>
        <div class="tile is-ancestor">
          <div class="tile is-parent">
            <a on:click={() => showBattuta(true)} class={defaultClasses + 'is-primary'}>
              Battuta {manuale ? '1...' : '#' + battutaSquadra1.ptr.jersey + ' ' + battutaSquadra1.surname}
            </a>
          </div>
          <div class="tile is-parent">
            <a on:click={() => showBattuta(false)} class={defaultClasses + 'is-primary'}>
              Battuta {manuale ? '2...' : '#' + battutaSquadra2.ptr.jersey + ' ' + battutaSquadra2.surname}
            </a>
          </div>
        </div>
        <div class="tile is-ancestor">
          <div class="tile is-parent">
            <a on:click={() => showAce(true)} class={defaultClasses + 'is-primary'}>
              Ace {manuale ? '1...' : battutaSquadra1.surname}
            </a>
          </div>
          <div class="tile is-parent">
            <a on:click={() => showMuro(true)} class={defaultClasses + 'is-primary'}> Muro 1... </a>
          </div>
        </div>
        <div class="tile is-ancestor">
          <div class="tile is-parent">
            <a on:click={showCrediti} class={defaultClasses + 'is-success'}> Crediti </a>
          </div>
        </div>
        <div class="tile is-ancestor">
          <div class="tile is-parent">
            <a on:click={showPoints} class={defaultClasses + 'is-info'}>Mostra Punti</a>
          </div>
          <div class="tile is-parent">
            <a on:click={resetPopup} class:is-warning={popupVisible} class={defaultClasses + 'is-info reset'}> Reset </a>
          </div>
        </div>
      {/if}
      <Effetti {obs} visible={activeTab == 3} />
      {#if activeTab == 4}
        <h3 class="title is-3">Titolo</h3>
        <div class="content">
          <button class="button" on:click={() => (title = 'Intervista')}>Intervista</button>
        </div>
        <div class="tile is-ancestor">
          <div class="tile is-parent">
            <input class="input" type="text" bind:value={title} />
          </div>
        </div>
        <h3 class="title is-3">SottoTitolo</h3>
        <div class="content">
          <button class="button" on:click={() => caricaGiocatore(true)}>Carica Giocatore 1...</button>
          <button class="button" on:click={() => caricaGiocatore(false)}>Carica Giocatore 2...</button>
        </div>
        <div class="tile is-ancestor">
          <div class="tile is-parent">
            <input class="input" type="text" bind:value={subtitle} />
          </div>
        </div>
        <h3 class="title is-3">Preview</h3>
        <div class="tile is-ancestor">
          <div class="tile is-parent">
            <p class="tile is-child">Titolo: {title}</p>
            <p class="tile is-child">SottoTitolo: {subtitle}</p>
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>
