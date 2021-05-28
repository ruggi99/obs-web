<script>
  export let obs;
  export let visible;

  import { mdiVolumeOff, mdiVolumeLow, mdiVolumeMedium, mdiVolumeHigh } from '@mdi/js';
  import { onMount } from 'svelte';
  import Icon from 'mdi-svelte';

  let defaultClasses = 'tile is-child column notification is-size-3 is-size-4-mobile has-text-centered ';

  function createChunk(players, quantity) {
    return Array(Math.ceil(players.length / quantity))
      .fill()
      .map((_, index) => index * quantity)
      .map((begin) => players.slice(begin, begin + quantity));
  }

  let micSources = [];
  let micSourcesC = [];
  $: micSourcesC = createChunk(micSources, 2);

  let getVolumeLastCalled = 0;

  onMount(getMics);

  obs.on('SceneItemAdded', getMics);
  obs.on('SceneItemRemoved', getMics);
  obs.on('SourceRenamed', getMics);

  async function getMics() {
    var res = await obs.send('GetSourcesList');
    var sources = res.sources;
    micSources = sources.filter((s) => s.typeId == 'wasapi_input_capture').sort((a, b) => a.name.localeCompare(b.name));
    //micSources = (await obs.send('GetSceneItemList', { sceneName: 'Audio (hidden)' })).sceneItems;
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
    // PEr vedere se è supportata la funzione
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

  async function handleMic(micName) {
    var mic = micSources.find((mic) => mic.name == micName);
    await obs.send('SetMute', { source: mic.name, mute: !mic.muted });
  }

  async function handleVolume(sourceName, up) {
    var mic = micSources.find((mic) => mic.name == sourceName);
    if (!mic || (up && mic.volume > -1.0)) return;
    await await obs.send('SetVolume', { source: mic.name, volume: up ? mic.volume + 1.0 : mic.volume - 1.0, useDecibel: true });
  }

  function micIcon(mic) {
    if (mic.muted || !mic.visible) return mdiVolumeOff;
    if (mic.volume < -20) return mdiVolumeLow;
    if (mic.volume < -10) return mdiVolumeMedium;
    return mdiVolumeHigh;
  }

  obs.on('TransitionEnd', async () => {
    getMicsVisible();
  });

  obs.on('SourceMuteStateChanged', (data) => {
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
</script>

{#if visible}
  {#each micSourcesC as chunk}
    <div class="tile is-ancestor">
      {#each chunk as mic}
        <div class="tile is-parent is-vertical">
          <a on:click={() => handleMic(mic.name)} class:is-danger={!mic.visible || mic.muted} class:is-light={mic.visible && mic.muted} class={defaultClasses + 'is-info'}>
            <span class="icon"><Icon path={micIcon(mic)} /></span>
            <span>{mic.name} </span>
          </a>
          <div class="columns">
            <div class="column">
              <a on:click={() => handleVolume(mic.name, false)} class="tile is-child column notification is-size-4 is-size-6-mobile has-text-centered is-primary">Volume -</a>
            </div>
            <div class="column">
              <a on:click={() => handleVolume(mic.name, true)} class="tile is-child column notification is-size-4 is-size-6-mobile has-text-centered is-primary">Volume +</a>
            </div>
          </div>
          <progress class="progress is-info" value={Math.max(mic.volume + 30, 0) || null} max="30" />
        </div>
      {/each}
    </div>
  {/each}
{/if}
