import { signIn } from './firebase.js';

function updateClock() {
  const clock = document.getElementById('clock');
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  clock.textContent = `${hours}:${minutes}:${seconds}`;
}

setInterval(updateClock, 1000);
updateClock();

document.addEventListener('DOMContentLoaded', async function() {
  const desktop = document.querySelector('.desktop');	
  const startButton = document.querySelector('.start-button');
  const menuContent = document.querySelector('.menu-content');
  const openChatBtn = document.getElementById('openChatBtn');
  const openListBtn = document.getElementById('openListBtn');
  const chatWindow = document.getElementById('chatWindow');
  const ListWindow = document.getElementById('ListWindow');
  const hideChatBtn = document.getElementById('hideChatBtn');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const broadcastBtn = document.getElementById('broadcastBtn');
  const voiceBtn = document.getElementById('voiceBtn');
  const hideListBtn = document.getElementById('hideListBtn');

  let userId;

  const observer = new MutationObserver(() => {
    if (chatMessages.scrollHeight > chatMessages.clientHeight) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });
  observer.observe(chatMessages, { childList: true });

  document.body.classList.add('loading');
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');

  userId = await signIn();

  document.body.classList.remove('loading');
  overlay.classList.add('hidden');

  const nicknameInput = document.getElementById('ListNickname');
  nicknameInput.value = userId;

  startButton.addEventListener('click', () => {
    const isMenuVisible = menuContent.style.display === 'block';
    menuContent.style.display = isMenuVisible ? 'none' : 'block';
  });

  document.addEventListener('click', function(event) {
    if (!startButton.contains(event.target) && !menuContent.contains(event.target)) {
      menuContent.style.display = 'none';
    }
  });

  openChatBtn.addEventListener('click', (event) => {
    menuContent.style.display = 'none';
    ListWindow.classList.add('hidden');
    chatWindow.classList.remove('hidden');
  });

  openListBtn.addEventListener('click', (event) => {
    menuContent.style.display = 'none';
    chatWindow.classList.add('hidden');
    ListWindow.classList.remove('hidden');
  });

  hideChatBtn.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
  });

  hideListBtn.addEventListener('click', () => {
    ListWindow.classList.add('hidden');
  });
  
  function checkBounds() {
    const desktopRect = desktop.getBoundingClientRect();
    const chatRect = chatWindow.getBoundingClientRect();
    const listRect = ListWindow.getBoundingClientRect();

    if (chatRect.right > desktopRect.right || chatRect.bottom > desktopRect.bottom) {
      chatWindow.classList.add('hidden');
    }

    if (listRect.right > desktopRect.right || listRect.bottom > desktopRect.bottom) {
      ListWindow.classList.add('hidden');
    }
  }

  window.addEventListener('resize', checkBounds);
  window.addEventListener('scroll', checkBounds);
  checkBounds();
});