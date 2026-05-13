let ws = null;
let audioContext = null;
let audioBuffer = null;
let sourceNode = null;
let myClientId = null;
let isReady = false;

const members = document.getElementById('members');
const status = document.getElementById('status');
const countdown = document.getElementById('countdown');
const readyBtn = document.getElementById('readyBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const tapBtn = document.getElementById('tapBtn');

async function init() {
  status.textContent = 'Loading audio...';
  try {
    const response = await fetch('track.mp3');
    if (!response.ok) throw new Error('Audio not found');
    const arrayBuffer = await response.arrayBuffer();
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    status.textContent = 'Connecting...';
    connectWebSocket();
  } catch (e) {
    status.textContent = 'Audio error';
  }
}

function connectWebSocket() {
  ws = new WebSocket('wss://band-sync.d257bk512.workers.dev/ws');
  ws.onopen = () => {
    status.textContent = 'Connected';
    readyBtn.disabled = false;
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
  if (msg.type === 'countdown') startCountdown();
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

function startCountdown() {
  readyBtn.disabled = true;
  startBtn.disabled = true;
  
  let sec = 3;
  countdown.textContent = sec;
  
  const iv = setInterval(() => {
    sec--;
    if (sec > 0) {
      countdown.textContent = sec;
    } else {
      clearInterval(iv);
      countdown.textContent = '';
      showTapButton();
    }
  }, 1000);
}

function showTapButton() {
  tapBtn.classList.add('active');
}

function onTap() {
  tapBtn.classList.remove('active');
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
tapBtn.onclick = onTap;

init();
