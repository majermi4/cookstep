export function createPwa({safeToUpdate, changed, notify, installHelp}) {
  let registration, prompt, applying = false;
  const state = {supported: 'serviceWorker' in navigator && window.isSecureContext, ready: false, update: false, install: false, error: false};
  const emit = () => changed({...state});
  const safe = async () => {try {return await safeToUpdate();} catch {return false;}};
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  state.installed = Boolean(standalone());
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();prompt = event;state.install = !standalone();emit();
  });
  window.addEventListener('appinstalled', () => {prompt = null;state.install = false;state.installed = true;emit();});
  navigator.serviceWorker?.addEventListener('message', async event => {
    if (event.data?.type === 'COOKSTEP_CAN_UPDATE') {
      event.ports[0]?.postMessage(await safe());
    }
  });
  navigator.serviceWorker?.addEventListener('controllerchange', async () => {
    if (await safe() && (applying || state.update)) location.reload();
    else {state.ready = true;emit();}
  });
  async function check(manual = false) {
    if (!registration || !navigator.onLine) {if(manual)notify('Reconnect to check for updates.');return;}
    try {
      await registration.update();
      if(manual)notify(registration.installing?'Downloading an update…':registration.waiting?'Update available':'No new version available.');
    } catch {if(manual)notify('Could not check for updates. Try again when connected.');}
  }
  async function start() {
    if (!state.supported) return;
    try {
      registration = await navigator.serviceWorker.register('/sw.js', {scope: '/', updateViaCache: 'none'});
      const refresh = () => {state.update = Boolean(registration.waiting);state.ready = Boolean(registration.active);state.error = false;emit();};
      const watchInstalling = () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'redundant') {state.error = true;emit();}
          else refresh();
        });
      };
      registration.addEventListener('updatefound', watchInstalling);
      watchInstalling();
      refresh();
      navigator.serviceWorker.ready.then(refresh);
      window.addEventListener('online', () => void check());
      document.addEventListener('visibilitychange', () => {if (document.visibilityState === 'visible') void check();});
      setInterval(() => {if (document.visibilityState === 'visible') void check();}, 60 * 60 * 1000);
    } catch {state.error = true;emit();}
  }
  return {
    state, start, check,
    async install() {
      if (!prompt) {installHelp();return;}
      const event = prompt;prompt = null;state.install = false;emit();
      await event.prompt();await event.userChoice;
    },
    async update() {
      if (!registration?.waiting || applying) return;
      if (!await safe()) {notify('Finish cooking and save your changes before updating.');return;}
      applying = true;
      const allowed = await new Promise(resolve => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => {channel.port1.close();resolve(false);}, 6000);
        channel.port1.onmessage = event => {clearTimeout(timeout);channel.port1.close();resolve(event.data?.allowed === true);};
        registration.waiting.postMessage({type: 'COOKSTEP_APPLY_UPDATE'}, [channel.port2]);
      });
      if (!allowed) {applying = false;notify('Finish cooking or close other Cookstep windows, then try updating again.');}
    }
  };
}
