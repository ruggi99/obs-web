<script>
  export let obs;
  export let visible;

  import { mdiBullhorn } from '@mdi/js';
  import { onMount } from 'svelte';
  import Icon from 'mdi-svelte';

  let defaultClasses = 'tile is-child column notification is-size-3 is-size-4-mobile has-text-centered ';

  function createChunk(players, quantity) {
    return Array(Math.ceil(players.length / quantity))
      .fill()
      .map((_, index) => index * quantity)
      .map((begin) => players.slice(begin, begin + quantity));
  }

  let effectSources = [];
  let effectSourcesC = [];
  $: effectSourcesC = createChunk(effectSources, 2);

  async function getEffects() {
    effectSources = (await obs.send('GetSceneItemList', { sceneName: 'Effetti (hidden)' })).sceneItems;
    for (const eff of effectSources) {
      await handleEff(eff.sourceName, false);
    }
  }

  onMount(() => {
    getEffects();
  });

  obs.on('SceneItemAdded', getEffects);
  obs.on('SceneItemRemoved', getEffects);

  obs.on('SceneItemVisibilityChanged', function (data) {
    console.log(data);
    effectSources = effectSources.map(function (eff) {
      if (data.itemName == eff.sourceName) return { ...eff, playing: data.itemVisible };
      return eff;
    });
  });

  obs.on('MediaEnded', async (data) => {
    handleEff(data.sourceName, false);
  });

  // visible: Se non specificato toggle
  async function handleEff(sourceName, visible) {
    var eff = effectSources.find((eff) => eff.sourceName == sourceName);
    if (!eff) return;
    visible = visible ?? !eff.playing;
    await obs.send('SetSceneItemProperties', { item: sourceName, 'scene-name': 'Effetti (hidden)', visible: visible });
  }
</script>

{#if visible}
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
