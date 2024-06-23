import { sendMessage, receiveMessages, signIn } from './chat.js';

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
  const startButton = document.querySelector('.start-button');
  const menuContent = document.querySelector('.menu-content');
  const openChatBtn = document.getElementById('openChatBtn');
  const chatWindow = document.getElementById('chatWindow');
  const hideChatBtn = document.getElementById('hideChatBtn');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  const observer = new MutationObserver(() => {
    if (chatMessages.scrollHeight > chatMessages.clientHeight) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });
  observer.observe(chatMessages, { childList: true });

  const displayedMessageIds = new Set();

  document.body.classList.add('loading');
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');

  await signIn();

  document.body.classList.remove('loading');
  overlay.classList.add('hidden');

  receiveMessages((messages) => {
    if (messages) {
      for (const id in messages) {
        if (!displayedMessageIds.has(id)) {
          const message = messages[id];
          const messageElement = document.createElement('div');
          messageElement.textContent = `${message.user}: ${message.text}`;
          chatMessages.appendChild(messageElement);
          displayedMessageIds.add(id);
        }
      }
    }
  });

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
    event.preventDefault();
    menuContent.style.display = 'none';
    chatWindow.classList.remove('hidden');
  });

  hideChatBtn.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
    console.log('Hide button clicked');
  });

  sendBtn.addEventListener('click', () => {
    const text = chatInput.value;
    if (text.trim() !== '') {
      sendMessage(text);
      chatInput.value = '';
    }
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendBtn.click();
    }
  });
});