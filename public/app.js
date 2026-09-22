const $ = s => document.querySelector(s);
const messagesEl = $('#messages');
const welcomeEl = $('#welcome');
const inputEl = $('#input');
const sendBtn = $('#send');
const chatListEl = $('#chatList');
const sidebar = document.querySelector('.sidebar');

let chats = JSON.parse(localStorage.getItem('brinky-cloud-chats') || '[]');
let activeId = localStorage.getItem('brinky-cloud-active') || null;

function save(){localStorage.setItem('brinky-cloud-chats',JSON.stringify(chats)); if(activeId)localStorage.setItem('brinky-cloud-active',activeId)}
function active(){return chats.find(c=>c.id===activeId)}
function ensureChat(){if(!active()){const c={id:crypto.randomUUID(),title:'New chat',messages:[]};chats.unshift(c);activeId=c.id;save()}return active()}
function renderList(){chatListEl.innerHTML=''; chats.forEach(c=>{const b=document.createElement('button');b.className='chat-item'+(c.id===activeId?' active':'');b.textContent=c.title;b.onclick=()=>{activeId=c.id;save();render()};chatListEl.appendChild(b)})}
function render(){renderList();const c=active();messagesEl.innerHTML='';if(!c||!c.messages.length){welcomeEl.style.display='block';messagesEl.style.display='none';return}welcomeEl.style.display='none';messagesEl.style.display='block';c.messages.forEach(m=>addMessageEl(m.role,m.content));window.scrollTo({top:document.body.scrollHeight})}
function addMessageEl(role,content){const row=document.createElement('div');row.className='message '+role;const av=document.createElement('div');av.className='avatar';av.textContent=role==='user'?'You':'B';const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=content;row.append(av,bubble);messagesEl.appendChild(row)}
function autoGrow(){inputEl.style.height='auto';inputEl.style.height=Math.min(inputEl.scrollHeight,180)+'px'}
async function checkHealth(){try{const r=await fetch('/api/health');const d=await r.json();$('#status').textContent=d.aiConfigured?'AI connected':'AI needs setup';$('#status').className='status '+(d.aiConfigured?'good':'bad')}catch{$('#status').textContent='Server offline';$('#status').className='status bad'}}
async function sendMessage(prefill){const text=(prefill??inputEl.value).trim();if(!text)return;const c=ensureChat();const history=c.messages.slice(-20);c.messages.push({role:'user',content:text});if(c.title==='New chat')c.title=text.slice(0,36)+(text.length>36?'…':'');save();inputEl.value='';autoGrow();render();sendBtn.disabled=true;addMessageEl('assistant','Thinking…');window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history})});const d=await r.json();messagesEl.lastElementChild?.remove();if(!r.ok)throw new Error(d.error||'Request failed');c.messages.push({role:'assistant',content:d.reply});save();render()}catch(e){messagesEl.lastElementChild?.remove();c.messages.push({role:'assistant',content:`I couldn't answer that yet. ${e.message}`});save();render()}finally{sendBtn.disabled=false;inputEl.focus()}}
$('#newChat').onclick=()=>{const c={id:crypto.randomUUID(),title:'New chat',messages:[]};chats.unshift(c);activeId=c.id;save();render();inputEl.focus()};
$('#send').onclick=()=>sendMessage();
inputEl.addEventListener('input',autoGrow);
inputEl.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});
document.querySelectorAll('.quick').forEach(b=>b.onclick=()=>sendMessage(b.dataset.prompt));
$('#menu').onclick=()=>sidebar.classList.toggle('open');
ensureChat();render();checkHealth();
