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
  import { mdiVolumeOff, mdiVolumeLow, mdiVolumeMedium, mdiVolumeHigh, mdiRewind, mdiBullhorn } from '@mdi/js';
  import Icon from 'mdi-svelte';

  onMount(async () => {
    await load();
    Array.from(document.querySelectorAll('.modal-background, .modal-close')).forEach((el) => el.addEventListener('click', () => cancelModal()));
  });

  // State
  let activeTab = 0;

  let nameSquadra1,
    nameSquadra2 = '';
  let match = {};

  let playersSquadra1 = [],
    playersSquadra2 = [];
  let micSources = [];
  let effectSources = [];

  let battutaSquadra1 = undefined,
    battutaSquadra2 = undefined;

  let lastFetchTime = 0;
  let getVolumeLastCalled = 0;
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
  $: micSourcesC = createChunk(micSources, 2);
  $: effectSourcesC = createChunk(effectSources, 2);

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function load() {
    match = await fetch('match.php').then((r) => r.json());
    var names = await fetch('names.json')
      .then((r) => r.json())
      .catch((e) => []);
    if (!match) return;
    var squadra1 = match.incasa ? match.hteam : match.vteam;
    var squadra2 = match.incasa ? match.vteam : match.hteam;
    var idSquadra1 = squadra1.id;
    var idSquadra2 = squadra2.id;
    nameSquadra1 = names[idSquadra1] || squadra1.disp_name;
    nameSquadra2 = names[idSquadra2] || squadra2.disp_name;
    playersSquadra1 = squadra1.players;
    playersSquadra2 = squadra2.players;
    await fixBrowsers(names);
    await getSourcesList();
    await getEffects();
    rotations();
  }

  async function fixBrowsers(names) {
    var nameCasa = names[match.hteam_id] || match.hteam.disp_name2;
    var nameOspiti = names[match.vteam_id] || match.vteam.disp_name2;
    let punteggio = `https://srv.matchshare.it/stats_test/rest_api/overlay?mid=${match.id}&client_name=volleynetworkitalia&bg=0&uid=613`;
    let punteggioesteso = `https://srv.matchshare.it/stats_test/rest_api/overlay3?mid=${match.id}&client_name=volleynetworkitalia&bg=0`;
    let roster = `https://srv.matchshare.it/stats_test/rest_api/overlay2?mid=${match.id}&client_name=volleynetworkitalia`;
    let punti = `https://srv.matchshare.it/stats_test/rest_api/overlay7?mid=${match.id}&client_name=volleynetworkitalia`;
    var punteggiocss = `body {background-color: rgba(0, 0, 0, 0); margin: 20px 0 0 20px; overflow: hidden;}
  table {overflow: hidden; background: rgba(255, 128, 0, 0.75); border-color: white;}
  .logos {display: none;}
  .hteam, .vteam {border-left: none; text-align: left;}
  td {color: white; border-color: white;}
  td:nth-child(-n+3) { background-color: rgba(0, 0, 0, 0.20); }
  .hteam, .vteam {color: transparent;}
  .hteam::before, .vteam::before {color: white; position: absolute;}
  .hteam::before {content: "${nameCasa}";}
  .vteam::before {content: "${nameOspiti}";}`;
    var punteggioestesocss = `body { background-color: rgba(0, 0, 0, 0); margin: 0px 0px; overflow: hidden; }
  table { overflow: hidden; background: rgba(0, 0, 0, 0.75);}
  .logos {display: none;}
  .hteam, .vteam {border-left: none; text-align: left;}
  td {color: white;}
  td:nth-child(-n+3) {background-color: rgba(0, 0, 0, 1);}
  table { --color: rgb(238, 85, 46);}
  table {border-color: var(--color);}
  td { border-color: var(--color);}
  .hteam, .vteam {color:transparent;}
  .hteam::before, .vteam::before {color: white; position: absolute;}
  .hteam::before {content: "${nameCasa}";}
  .vteam::before {content: "${nameOspiti}";}`;
    await obs.send('SetSourceSettings', { sourceName: 'Punteggio', sourceSettings: { url: punteggio, css: punteggiocss } }).catch((_) => false);
    await obs.send('SetSourceSettings', { sourceName: 'Punteggio esteso', sourceSettings: { url: punteggioesteso, css: punteggioestesocss } }).catch((_) => false);
    await obs.send('SetSourceSettings', { sourceName: 'RosterB', sourceSettings: { url: roster } }).catch((_) => false);
    await obs.send('SetSourceSettings', { sourceName: 'PuntiB', sourceSettings: { url: punti } }).catch((_) => false);
  }

  async function getSourcesList() {
    var res = await obs.send('GetSourcesList');
    var sources = res.sources;
    micSources = sources.filter((s) => s.typeId == 'wasapi_input_capture').sort((a, b) => a.name.localeCompare(b.name));
    for (var mic of micSources) {
      await getVolume(mic.name);
    }
    await getMicsVisible();
    console.log('MicSources:', micSources);
  }

  async function getVolume(name) {
    var res = await obs.send('GetVolume', { source: name, useDecibel: true });
    micSources = micSources.map((mic) => (mic.name == name ? { ...mic, volume: Math.round(res.volume), muted: res.muted } : mic));
  }

  async function getMicsVisible() {
    if (!micSources.length) return;
    var res = await obs.send('GetSourceActive', { sourceName: micSources[0].name }).catch((_) => false);
    if (res) {
      for (var micIndex in micSources) {
        micSources[micIndex].visible = (await obs.send('GetSourceActive', { sourceName: micSources[micIndex].name })).sourceActive;
      }
    } else {
      var sceneItems = (await obs.send('GetSceneItemList')).sceneItems;
      var sources = [];
      var iter = 5;
      while (sceneItems.length && --iter) {
        var typeScene = sceneItems.filter((s) => s.sourceKind == 'scene');
        var typeInput = sceneItems.filter((s) => s.sourceType == 'input');
        sources.push(...typeInput);
        sceneItems = [];
        for (var scene of typeScene) {
          sceneItems.push(...(await obs.send('GetSceneItemList', { sceneName: scene.sourceName })).sceneItems);
        }
      }
      console.log(sources);
      // Controllo se i microfoni sono visibli nella scena
      micSources = micSources.map(function (mic) {
        var found = sources.find((s) => s.sourceName == mic.name);
        return { ...mic, visible: !!found };
      });
    }
  }

  // Called at startup
  async function getEffects() {
    effectSources = (await obs.send('GetSceneItemList', { sceneName: 'Effetti (hidden)' })).sceneItems;
    for (const eff of effectSources) {
      await handleEff(eff.sourceName, false);
    }
    console.log('effectSources:', effectSources);
  }

  function createChunk(players, quantity) {
    return Array(Math.ceil(players.length / quantity))
      .fill()
      .map((_, index) => index * quantity)
      .map((begin) => players.slice(begin, begin + quantity));
  }

  async function rotations() {
    var rotation = await fetch(`match_live.php?mid=${match.id}`)
      .then((r) => r.json())
      .catch((e) => {});
    if (rotation.length !== 0) {
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

  function showTimeout(sq1) {
    var name = sq1 ? nameSquadra1 : nameSquadra2;
    obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'timeout', who: name } });
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
    if (manuale) {
      openModal(sq1);
      var res = await modalClosed();
      if (!res) return;
      var player = playersSquadra1.concat(playersSquadra2).find((pl) => pl.id == lastSelectedId);
    } else {
      var player = sq1 ? battutaSquadra1 : battutaSquadra2;
    }
    obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'ace', player: player } });
    handleEff('Hazzard');
    console.log(lastSelectedId, player);
  }

  async function showMuro(sq1) {
    openModal(sq1);
    var res = await modalClosed();
    if (!res) return;
    var player = playersSquadra1.concat(playersSquadra2).find((pl) => pl.id == lastSelectedId);
    obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'muro', player: player } });
    handleEff('Hazzard'); // Set visible
    console.log(lastSelectedId, player);
  }

  async function customPopup() {
    obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'custom', title: title, subtitle: subtitle } });
  }

  async function resetPopup() {
    obs.send('BroadcastCustomMessage', { realm: 'overlayer', data: { type: 'reset' } });
  }

  function micIcon(mic) {
    if (mic.muted || !mic.visible) return mdiVolumeOff;
    if (mic.volume < -20) return mdiVolumeLow;
    if (mic.volume < -10) return mdiVolumeMedium;
    return mdiVolumeHigh;
  }

  async function handleMic(e) {
    var parent = this.parentElement;
    var mic = micSources.find((mic) => mic.name == parent.dataset.name);
    if (this.nodeName == 'A') {
      await obs.send('SetMute', { source: mic.name, mute: !mic.muted });
    } else {
      await obs.send('SetVolume', { source: mic.name, volume: mic.volume, useDecibel: true });
    }
  }

  async function volume(sourceName, up) {
    var mic = micSources.find((mic) => mic.name == sourceName);
    if (!mic) return;
    await await obs.send('SetVolume', { source: mic.name, volume: up ? mic.volume + 1.0 : mic.volume - 1.0, useDecibel: true });
  }

  // visible: Se non specificato toggle
  async function handleEff(sourceName, visible) {
    var eff = effectSources.find((eff) => eff.sourceName == sourceName);
    if (!eff) return;
    visible = visible ?? !eff.playing;
    await obs.send('SetSceneItemProperties', { item: sourceName, 'scene-name': 'Effetti (hidden)', visible: visible });
  }

  obs.on('BroadcastCustomMessage', async (data) => {
    if (data.realm != 'overlay') return;
    popupVisible = data.data.visible;
  });

  obs.on('TransitionEnd', async () => {
    //await sleep(200);
    getMicsVisible();
  });

  obs.on('SourceMuteStateChanged', (data) => {
    /*var micIndex = micSources.findIndex((mic) => mic.name == data.sourceName);
    if (micIndex < 0) return;
    micSources[micIndex].muted = data.muted;*/
    micSources = micSources.map(function (mic) {
      if (mic.name == data.sourceName) return { ...mic, muted: data.muted };
      return mic;
    });
  });

  obs.on('SourceVolumeChanged', async (data) => {
    if (data.volumeDb !== undefined) {
      micSources = micSources.map((mic) => (mic.name == data.sourceName ? { ...mic, volume: Math.round(data.volumeDb) } : mic));
      return;
    }
    console.log('Errore');
    if (new Date().getTime() - getVolumeLastCalled < 200) return;
    await getVolume(data.sourceName);
    getVolumeLastCalled = new Date().getTime();
  });

  obs.on('SceneItemVisibilityChanged', function (data) {
    console.log(data);
    effectSources = effectSources.map(function (eff) {
      if (data.itemName == eff.sourceName) return { ...eff, playing: data.itemVisible };
      return eff;
    });
  });

  /*obs.on('MediaStarted', async (data) => {
    effectSources = effectSources.map(function (eff) {
      if (data.sourceName == eff.sourceName) return { ...eff, playing: true };
      return eff;
    });
  });*/

  obs.on('MediaEnded', async (data) => {
    handleEff(data.sourceName, false);
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
<div class="tabs is-toggle is-fullwidth is-medium">
  <ul>
    {#each ['Scene + mic', 'Popup + effetti', 'Pers.'] as text, i}
      <li class:is-active={activeTab == i}>
        <a
          on:click={function (e) {
            activeTab = i;
          }}>{text}</a
        >
      </li>
    {/each}
  </ul>
</div>
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
    {#each micSourcesC as chunk}
      <div class="tile is-ancestor">
        {#each chunk as mic}
          <div class="tile is-parent is-vertical" data-name={mic.name}>
            <a on:click={mic.visible ? handleMic : null} class:is-danger={!mic.visible || mic.muted} class:is-light={mic.visible && mic.muted} class={defaultClasses + 'is-info'}>
              <span class="icon"><Icon path={micIcon(mic)} /></span>
              <span>{mic.name} </span>
            </a>
            <div class="columns">
              <div class="column">
                <a on:click={() => volume(mic.name, false)} class="tile is-child column notification is-size-4 is-size-6-mobile has-text-centered is-primary">Volume -</a>
              </div>
              <div class="column">
                <a on:click={() => volume(mic.name, true)} class="tile is-child column notification is-size-4 is-size-6-mobile has-text-centered is-primary">Volume +</a>
              </div>
            </div>
            <progress class="progress is-info" value={Math.max(mic.volume + 30, 0) || null} max="30" />
            <!--<input type="range" min="-30" max="0" bind:value={mic.volume} on:input={handleMic} />-->
          </div>
        {/each}
      </div>
    {/each}
  {/if}
  {#if activeTab == 1}
    <div class="tile is-ancestor">
      <div class="tile is-parent">
        <a on:click={startReplay} class={defaultClasses + 'is-info'} class:is-success={currentScene?.includes('Replay')}>
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
          Battuta {manuale ? '1...' : battutaSquadra1.surname}
        </a>
      </div>
      <div class="tile is-parent">
        <a on:click={() => showBattuta(false)} class={defaultClasses + 'is-primary'}>
          Battuta {manuale ? '2...' : battutaSquadra2.surname}
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
        <a on:click={() => showAce(false)} class={defaultClasses + 'is-primary'}>
          Ace {manuale ? '2...' : battutaSquadra2.surname}
        </a>
      </div>
    </div>
    <div class="tile is-ancestor">
      <div class="tile is-parent">
        <a on:click={() => showMuro(true)} class={defaultClasses + 'is-primary'}> Muro 1... </a>
      </div>
      <div class="tile is-parent">
        <a on:click={() => showMuro(false)} class={defaultClasses + 'is-primary'}> Muro 2... </a>
      </div>
    </div>
    <div class="tile is-ancestor">
      <div class="tile is-parent">
        <a on:click={customPopup} class={defaultClasses + 'is-info'}> Personalizzato </a>
      </div>
      <div class="tile is-parent">
        <a on:click={resetPopup} class:is-warning={popupVisible} class={defaultClasses + 'is-info reset'}> Reset </a>
      </div>
    </div>
    {#each effectSourcesC as chunk}
      <div class="tile is-ancestor">
        {#each chunk as eff}
          <div class="tile is-parent" data-name={eff.sourceName}>
            <a on:click={() => handleEff(eff.sourceName)} class:is-light={!eff.playing} class={defaultClasses + 'is-info'}>
              <span class="icon"><Icon path={mdiBullhorn} /></span>
              <span>{eff.sourceName} </span>
            </a>
          </div>
        {/each}
      </div>
    {/each}
  {/if}
  {#if activeTab == 2}
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
