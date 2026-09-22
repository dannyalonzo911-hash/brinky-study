const $ = s => document.querySelector(s);
const messagesEl = $('#messages');
const welcomeEl = $('#welcome');
const inputEl = $('#input');
const sendBtn = $('#send');
const chatListEl = $('#chatList');
const sidebar = document.querySelector('.sidebar');
const pastePreview = $('#pastePreview');
const pasteImage = $('#pasteImage');
const removeImageBtn = $('#removeImage');
const attachBtn = $('#attach');
const fileInput = $('#imageInput');

let chats = JSON.parse(localStorage.getItem('brinky-cloud-chats') || '[]');
let activeId = localStorage.getItem('brinky-cloud-active') || null;
let pendingImage = null;

function save(){localStorage.setItem('brinky-cloud-chats',JSON.stringify(chats)); if(activeId)localStorage.setItem('brinky-cloud-active',activeId)}
function active(){return chats.find(c=>c.id===activeId)}
function ensureChat(){if(!active()){const c={id:crypto.randomUUID(),title:'New chat',messages:[]};chats.unshift(c);activeId=c.id;save()}return active()}
function renderList(){chatListEl.innerHTML=''; chats.forEach(c=>{const b=document.createElement('button');b.className='chat-item'+(c.id===activeId?' active':'');b.textContent=c.title;b.onclick=()=>{activeId=c.id;save();render()};chatListEl.appendChild(b)})}
function render(){renderList();const c=active();messagesEl.innerHTML='';if(!c||!c.messages.length){welcomeEl.style.display='block';messagesEl.style.display='none';return}welcomeEl.style.display='none';messagesEl.style.display='block';c.messages.forEach(m=>addMessageEl(m.role,m.content,m.hadImage));window.scrollTo({top:document.body.scrollHeight})}
function addMessageEl(role,content,hadImage=false){const row=document.createElement('div');row.className='message '+role;const av=document.createElement('div');av.className='avatar';av.textContent=role==='user'?'You':'B';const bubble=document.createElement('div');bubble.className='bubble';if(hadImage){const tag=document.createElement('div');tag.className='image-tag';tag.textContent='📷 Screenshot attached';bubble.appendChild(tag)}const text=document.createElement('div');text.textContent=content;bubble.appendChild(text);row.append(av,bubble);messagesEl.appendChild(row)}
function autoGrow(){inputEl.style.height='auto';inputEl.style.height=Math.min(inputEl.scrollHeight,180)+'px'}
async function checkHealth(){try{const r=await fetch('/api/health');const d=await r.json();$('#status').textContent=d.aiConfigured?'AI connected':'AI needs setup';$('#status').className='status '+(d.aiConfigured?'good':'bad')}catch{$('#status').textContent='Server offline';$('#status').className='status bad'}}

function clearPendingImage(){pendingImage=null;pasteImage.removeAttribute('src');pastePreview.hidden=true;fileInput.value=''}

async function compressImage(file){
  if(!file || !file.type.startsWith('image/')) throw new Error('That is not an image.');
  const bitmap = await createImageBitmap(file);
  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap,0,0,width,height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg',0.9);
}

async function setPendingImage(file){
  try{
    const dataUrl = await compressImage(file);
    pendingImage = dataUrl;
    pasteImage.src = dataUrl;
    pastePreview.hidden = false;
    inputEl.focus();
  }catch(e){
    alert(e.message || 'Could not attach that image.');
  }
}

async function sendMessage(prefill){
  const text=(prefill??inputEl.value).trim();
  if(!text && !pendingImage)return;
  const c=ensureChat();
  const history=c.messages.slice(-20).map(({role,content})=>({role,content}));
  const imageToSend = pendingImage;
  const messageText = text || 'Please analyze this screenshot and help me with what is shown.';
  c.messages.push({role:'user',content:messageText,hadImage:Boolean(imageToSend)});
  if(c.title==='New chat')c.title=messageText.slice(0,36)+(messageText.length>36?'…':'');
  save();inputEl.value='';clearPendingImage();autoGrow();render();sendBtn.disabled=true;addMessageEl('assistant','Thinking…');window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});
  try{
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:messageText,history,image:imageToSend})});
    const d=await r.json();messagesEl.lastElementChild?.remove();if(!r.ok)throw new Error(d.error||'Request failed');c.messages.push({role:'assistant',content:d.reply});save();render()
  }catch(e){messagesEl.lastElementChild?.remove();c.messages.push({role:'assistant',content:`I couldn't answer that yet. ${e.message}`});save();render()}finally{sendBtn.disabled=false;inputEl.focus()}
}

$('#newChat').onclick=()=>{const c={id:crypto.randomUUID(),title:'New chat',messages:[]};chats.unshift(c);activeId=c.id;save();clearPendingImage();render();inputEl.focus()};
$('#send').onclick=()=>sendMessage();
inputEl.addEventListener('input',autoGrow);
inputEl.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});
inputEl.addEventListener('paste',async e=>{
  const items=[...(e.clipboardData?.items||[])];
  const imageItem=items.find(i=>i.kind==='file'&&i.type.startsWith('image/'));
  if(imageItem){e.preventDefault();const file=imageItem.getAsFile();if(file)await setPendingImage(file)}
});
attachBtn.onclick=()=>fileInput.click();
fileInput.onchange=()=>{const file=fileInput.files?.[0];if(file)setPendingImage(file)};
removeImageBtn.onclick=clearPendingImage;
document.querySelectorAll('.quick').forEach(b=>b.onclick=()=>sendMessage(b.dataset.prompt));
$('#menu').onclick=()=>sidebar.classList.toggle('open');
ensureChat();render();checkHealth();
