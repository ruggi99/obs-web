<script>
  const OBS_WEBSOCKET_LATEST_VERSION = '4.8.0'; // https://api.github.com/repos/Palakis/obs-websocket/releases/latest

  // Imports
  import { onMount } from 'svelte';
  import './style.scss';
  import { mdiFullscreen, mdiFullscreenExit, mdiBorderVertical, mdiArrowSplitHorizontal, mdiAccessPoint, mdiAccessPointOff, mdiRecord, mdiStop, mdiPause, mdiPlayPause } from '@mdi/js';
  import Icon from 'mdi-svelte';
  import compareVersions from 'compare-versions';

  // Import OBS-websocket
  import OBSWebSocket from 'obs-websocket-js';
  const obs = new OBSWebSocket();

  // Import local components

  onMount(async () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js');
    }

    // Request screen wakelock
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
          // Re-request when coming back
          document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
              wakeLock = await navigator.wakeLock.request('screen');
            }
          });
      }
      catch(e) { }
    }

    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      isFullScreen = document.fullscreenElement;
    });

    document.addEventListener('webkitfullscreenchange', () => {
      isFullScreen = document.webkitFullscreenElement;
    });

    document.addEventListener('msfullscreenchange', () => {
      isFullScreen = document.msFullscreenElement;
    });

    // Hamburger menu
    const $navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'), 0);
    if ($navbarBurgers.length > 0) {
      $navbarBurgers.forEach(el => {
        el.addEventListener('click', () => {
          const target = document.getElementById(el.dataset.target);
          el.classList.toggle('is-active');
          target.classList.toggle('is-active');
        });
      });
    }

    if (document.location.hash !== '') {
      // Read host from hash
      host = document.location.hash.slice(1);
      await connect();
    }
  });

  addEventListener("beforeunload", async () => {
    if (!connected) return;
    console.log("Disconnecting due to browser refreshing");
    await disconnect();
  })

  // State
  let connected,
    heartbeat,
    currentScene,
    currentPreviewScene,
    isFullScreen,
    isStudioMode,
    isSceneOnTop,
    wakeLock = false;
  let scenes = [];
  let host,
    password,
    errorMessage = '';

  let title = '';
  let who = '';
  let timeoutVisible = false;
  let fine = false;
  let toRight = false;

  // OBS functions
  async function sendCommand(command, params) {
    try {
      return await obs.send(command, params || {});
    } catch (e) {
      console.log('Error sending command', command, ' - error is:', e);
      return {};
    }
  }

  async function connect() {
    host = host || 'localhost:4444';
    let secure = location.protocol === 'https:' || host.endsWith(':443');
    if (host.indexOf('://') !== -1) {
      let url = new URL(host);
      secure = url.protocol === 'wss:' || url.protocol === 'https:';
      host = url.hostname + ':' + (url.port ? url.port : secure ? 443 : 80);
    }
    console.log('Connecting to:', host, '- secure:', secure, '- using password:', password);
    await disconnect();
    connected = false;
    try {
      await obs.connect({ address: host, password, secure });
    } catch (e) {
      console.log(e);
      errorMessage = e.description;
    }
  }

  async function disconnect() {
    await obs.disconnect();
    connected = false;
    errorMessage = 'Disconnected';
  }

  async function hostkey(event) {
    if (event.key !== 'Enter') return;
    await connect();
    event.preventDefault();
  }

  // OBS events
  obs.on('ConnectionClosed', () => {
    connected = false;
    console.log('Connection closed');
  });

  obs.on('AuthenticationSuccess', async () => {
    console.log('Connected');
    connected = true;
    document.location.hash = host; // For easy bookmarking
    const version = (await sendCommand('GetVersion')).obsWebsocketVersion || '';
    console.log('OBS-websocket version:', version);
    if(compareVersions(version, OBS_WEBSOCKET_LATEST_VERSION) < 0) {
      alert('You are running an outdated OBS-websocket (version ' + version + '), please upgrade to the latest version for full compatibility.');
    }
  });

  obs.on('AuthenticationFailure', async () => {
    password = prompt('Please enter your password:', password);
    if (password === null) {
      connected = false;
      password = '';
    } else {
      await connect();
    }
  });


  obs.on('error', err => {
    console.error('Socket error:', err);
  });

  function timeout(data) {
    if (timeoutVisible) { // Transizione di chiusura
      timeoutVisible = false;
      //fine = true;
      //await sleep(1000);
      //fine = false;
    } else { // Transizione di apertura
      title = "Timeout";
      who = data.who;
      toRight = !toRight;
      timeoutVisible = true;
    }
  }

  function battuta(data) {
    title = "Battuta";
    who = `#${data.ptr.jersey} ${data.surname}`;
    toRight = !toRight;
    timeoutVisible = true;
    await sleep(5000);
    timeoutVisible = false;
  }

  obs.on('BroadcastCustomMessage', async (data) => {
    if (data.realm != "overlayer")
      return;
    if (data.type == "timeout")
      return timeout(data.data);
    if (data.type == "battuta")
      return battuta(data.data);
    return false;
  });

</script>

<svelte:head>
  <title>OBS-web - control OBS from anywhere</title>
</svelte:head>

<div class:visible={timeoutVisible} class:toRight class="parent">
  <div class="ttitle">{title}</div>
  <div class="who">{who}</div>
</div>
