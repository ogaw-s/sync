let ws = null;
let audioContext = null;
let audioBuffer = null;
let sourceNode = null;
let myClientId = null;
let isReady = false;

let selectedSong = 'suisou';
let selectedType = 'sync';

const members = document.getElementById('members');
const status = document.getElementById('status');
const countdown = document.getElementById('countdown');
const readyBtn = document.getElementById('readyBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const tapBtn = document.getElementById('tapBtn');
const songSelector = document.getElementById('songSelector');
const typeSelector = document.getElementById('typeSelector');

function getTrackUrl() {
  return `tracks/${selectedSong}_${selectedType}.mp3`;
}

async function loadAudio() {
  status.textContent = 'Loading audio...';
  readyBtn.disabled = true;
  try {
    const response = await fetch(getTrackUrl());
    if (!response.ok) throw new Error('Audio not found');
    const arrayBuffer = await response.arrayBuffer();
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    status.textContent = 'Connected';
    readyBtn.disabled = false;
  } catch (e) {
    status.textContent = 'Audio error: ' + getTrackUrl();
    readyBtn.disabled = true;
  }
}

async function init() {
  await loadAudio();
  connectWebSocket();
}

function connectWebSocket() {
  ws = new WebSocket('wss://band-sync.d257bk512.workers.dev/ws');
  ws.onopen = () => {
    if (audioBuffer) {
      status.textContent = 'Connected';
      readyBtn.disabled = false;
    }
  };
  ws.onclose = () => {
    status.textContent = 'Disconnected';
    readyBtn.disabled = true;
    setTimeout(connectWebSocket, 2000);
  };
  ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
}

function handleMessage(msg) {
  if (msg.type === 'welcome') myClientId = msg.clientId;
  if (msg.type === 'status') updateMembers(msg.clients);
  if (msg.type === 'countdown') showTapButton();
}

function updateMembers(clients) {
  members.innerHTML = '';
  clients.forEach(c => {
    const el = document.createElement('div');
    el.className = 'member' + (c.ready ? ' ready' : '') + (c.id === myClientId ? ' me' : '');
    members.appendChild(el);
  });
  startBtn.disabled = !(clients.length > 0 && clients.every(c => c.ready) && isReady);
}

function prepareSourceNode() {
  if (sourceNode) {
    try { sourceNode.disconnect(); } catch {}
  }
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(audioContext.destination);
  sourceNode.onended = stopPlayback;
}

function showTapButton() {
  readyBtn.disabled = true;
  startBtn.disabled = true;
  tapBtn.classList.add('active');
}

let isHolding = false;

function onHold() {
  if (!tapBtn.classList.contains('active')) return;
  isHolding = true;
  tapBtn.classList.add('holding');
}

function onRelease() {
  if (!isHolding) return;
  isHolding = false;
  tapBtn.classList.remove('active', 'holding');
  sourceNode.start(0);
  stopBtn.classList.add('active');
}

function stopPlayback() {
  if (sourceNode) try { sourceNode.stop(); } catch {}
  sourceNode = null;
  stopBtn.classList.remove('active');
  tapBtn.classList.remove('active');
  countdown.textContent = '';
  isReady = false;
  readyBtn.textContent = 'Ready';
  readyBtn.classList.remove('ready');
  readyBtn.disabled = false;
  startBtn.disabled = true;
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'unready' }));
  }
}

// 曲選択
songSelector.onclick = async (e) => {
  if (!e.target.dataset.song) return;
  songSelector.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
  e.target.classList.add('selected');
  selectedSong = e.target.dataset.song;
  if (isReady) {
    isReady = false;
    readyBtn.textContent = 'Ready';
    readyBtn.classList.remove('ready');
    ws.send(JSON.stringify({ type: 'unready' }));
  }
  await loadAudio();
};

// タイプ選択
typeSelector.onclick = async (e) => {
  if (!e.target.dataset.type) return;
  typeSelector.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
  e.target.classList.add('selected');
  selectedType = e.target.dataset.type;
  if (isReady) {
    isReady = false;
    readyBtn.textContent = 'Ready';
    readyBtn.classList.remove('ready');
    ws.send(JSON.stringify({ type: 'unready' }));
  }
  await loadAudio();
};

readyBtn.onclick = async () => {
  if (audioContext?.state === 'suspended') await audioContext.resume();
  isReady = !isReady;
  readyBtn.textContent = isReady ? 'Ready!' : 'Ready';
  readyBtn.classList.toggle('ready', isReady);

  if (isReady) {
    prepareSourceNode();
  } else {
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch {}
      sourceNode = null;
    }
  }

  ws.send(JSON.stringify({ type: isReady ? 'ready' : 'unready' }));
};

startBtn.onclick = () => ws.send(JSON.stringify({ type: 'start' }));
stopBtn.onclick = stopPlayback;

// マウス/タッチで押して離す
tapBtn.onmousedown = onHold;
tapBtn.onmouseup = onRelease;
tapBtn.ontouchstart = (e) => { e.preventDefault(); onHold(); };
tapBtn.ontouchend = onRelease;

// スペースキーで押して離す
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && tapBtn.classList.contains('active') && !e.repeat) {
    e.preventDefault();
    onHold();
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    onRelease();
  }
});

init();
