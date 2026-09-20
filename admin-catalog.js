(()=>{
'use strict';
const panel=document.getElementById('catalog-admin'),form=document.getElementById('catalog-import-form'),input=document.getElementById('catalog-file'),result=document.getElementById('catalog-import-result'),app=document.getElementById('app');
if(!panel||!form||!input||!result||!app)return;
const base=()=>typeof window.ROSEEN_API_BASE==='string'?window.ROSEEN_API_BASE:'';
async function available(){try{const r=await fetch(base()+'/api/store-admin/status',{credentials:'include'});if(r.status===200){panel.hidden=false;return true;}return false;}catch{return false;}}
const observer=new MutationObserver(()=>{if(!app.hidden)available();});observer.observe(app,{attributes:true,attributeFilter:['hidden']});if(!app.hidden)available();
form.addEventListener('submit',async e=>{
 e.preventDefault();result.textContent='';const file=input.files&&input.files[0];if(!file)return;
 const button=form.querySelector('button');button.disabled=true;
 try{
  if(file.size>2*1024*1024)throw new Error('Файл больше 2 МБ.');
  const response=await fetch(base()+'/api/store-admin/import-preview',{method:'POST',headers:{'Content-Type':'text/csv; charset=utf-8'},credentials:'include',body:await file.text()});
  const data=await response.json().catch(()=>null);
  if(response.status===401)throw new Error('Сессия истекла. Войдите снова.');
  if(!data)throw new Error('Сервис не вернул результат проверки.');
  const box=document.createElement('div');box.className='import-summary';
  const title=document.createElement('strong');
  title.textContent=data.ok?('Проверено: '+(data.summary?.rows||0)+' строк. Публикация не выполнялась.'):'Импорт не прошёл проверку.';
  box.append(title);
  if(Array.isArray(data.errors)&&data.errors.length){const ul=document.createElement('ul');ul.className='import-errors';data.errors.slice(0,50).forEach(err=>{const li=document.createElement('li');li.textContent='Строка '+(err.row||'—')+' · '+err.field+': '+err.message;ul.append(li);});box.append(ul);}
  result.replaceChildren(box);
 }catch(err){result.textContent=err.message||'Ошибка проверки файла.';}finally{button.disabled=false;}
});
})();
