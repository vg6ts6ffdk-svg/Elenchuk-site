(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const notice = byId('notice'), list = byId('list'), detail = byId('detail');
  const loginPanel = byId('login-panel'), app = byId('app');
  const statuses = {new:'Новая',diagnostics:'Диагностика',approval:'Согласование',repair:'В ремонте',ready:'Готово',closed:'Закрыта'};
  let before = null, selected = null;
  // Old versions stored a bearer token in localStorage. No token is stored in JS now.
  try { localStorage.removeItem('roseen_token'); } catch { /* Storage may be disabled. */ }
  function message(text) { notice.textContent = text; }
  function signedOut() { app.hidden = true; loginPanel.hidden = false; detail.hidden = true; list.replaceChildren(); selected = null; }
  async function api(path, options = {}) {
    if (typeof window.ROSEEN_API_BASE !== 'string') throw new Error('Настройка API не загрузилась. Обновите страницу.');
    const response = await fetch(window.ROSEEN_API_BASE + path, { ...options, credentials:'include' });
    const data = await response.json().catch(() => null);
    if (response.status === 401) { signedOut(); throw new Error('Войдите в админ-панель.'); }
    if (!response.ok) throw new Error(data?.error || 'Сервис не ответил. Повторите позже.');
    return data;
  }
  function element(tag,text,className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  async function load(append = false) {
    const query = append && before ? '?before=' + before : '';
    const rows = await api('/api/requests' + query);
    if (!Array.isArray(rows)) throw new Error('Неправильный ответ API.');
    if (!append) list.replaceChildren();
    for (const row of rows) {
      const card = element('button', undefined,'request-card');
      card.type = 'button';
      card.dataset.id = row.id;
      card.setAttribute('aria-pressed',String(selected === row.id));
      card.append(element('strong','Заявка №' + row.id + ' · ' + (statuses[row.status] || row.status)),
        element('span',row.equipment_type + (row.model ? ' / ' + row.model : '')),
        element('span',row.problem.slice(0,180)),
        element('span','Файлов: ' + row.files_count + ' · ' + row.created_at));
      list.append(card);
    }
    if (!list.children.length) list.append(element('p','Заявок пока нет.'));
    before = rows.at(-1)?.id || null;
    byId('more').hidden = rows.length < 50;
  }
  async function download(id,name,button) {
    button.disabled = true;
    try {
      const response = await fetch(window.ROSEEN_API_BASE + '/api/files/' + id, {credentials:'include'});
      if (response.status === 401) { signedOut(); throw new Error('Сессия истекла. Войдите снова.'); }
      if (!response.ok) throw new Error('Не удалось скачать файл.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = element('a');
      a.href = url; a.download = name;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url),1000);
    } finally { button.disabled = false; }
  }
  async function open(id) {
    const row = await api('/api/requests/' + id);
    selected = row.id;
    list.querySelectorAll('[data-id]').forEach(card => card.setAttribute('aria-pressed', String(Number(card.dataset.id) === row.id)));
    detail.replaceChildren(element('h2','Заявка №' + row.id));
    for (const [label,value] of [['Техника',row.equipment_type],['Модель',row.model||'Не указана'],['Неисправность',row.problem],['Контакт',row.contact]]) {
      detail.append(element('strong',label),element('p',value));
    }
    const form = element('form');
    const statusField = element('div',undefined,'field'), commentField = element('div',undefined,'field');
    const select = element('select'); select.id = 'request-status';
    for (const [value,label] of Object.entries(statuses)) {
      const option = element('option',label); option.value=value; option.selected=value===row.status; select.append(option);
    }
    const statusLabel = element('label','Статус'); statusLabel.htmlFor=select.id;
    statusField.append(statusLabel,select);
    const comment = element('textarea'); comment.id='request-comment'; comment.maxLength=5000; comment.value=row.comment||'';
    const commentLabel = element('label','Комментарий инженера'); commentLabel.htmlFor=comment.id;
    commentField.append(commentLabel,comment);
    const save = element('button','Сохранить','btn btn-primary'); save.type='submit';
    form.append(statusField,commentField,save);
    form.addEventListener('submit',async event => {
      event.preventDefault(); save.disabled=true;
      try {
        await api('/api/requests/' + id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:select.value,comment:comment.value})});
        message('Заявка №' + id + ' обновлена.');
        await load(); await open(id);
      } catch(error) { message(error.message); } finally { save.disabled=false; }
    });
    detail.append(form,element('h3','Файлы'));
    for (const file of row.files) {
      const line = element('div',undefined,'file-row');
      const button = element('button','Скачать','btn btn-ghost'); button.type='button';
      button.addEventListener('click',()=>download(file.id,file.original_name,button).catch(error=>message(error.message)));
      line.append(element('span',file.original_name + ' · ' + Math.round(file.size/1024) + ' КБ'),button); detail.append(line);
    }
    if (!row.files.length) detail.append(element('p','Нет вложений.'));
    detail.hidden=false;
  }
  byId('login-form').addEventListener('submit',async event => {
    event.preventDefault();
    const button=event.currentTarget.querySelector('button'); button.disabled=true;
    try {
      await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:byId('email').value,password:byId('password').value})});
      byId('password').value=''; loginPanel.hidden=true; app.hidden=false; message('Вход выполнен.'); await load();
    } catch(error) { message(error.message); } finally { button.disabled=false; }
  });
  list.addEventListener('click',event=>{
    const card=event.target.closest('[data-id]');
    if(card) open(Number(card.dataset.id)).catch(error=>message(error.message));
  });
  byId('refresh').addEventListener('click',()=>load().catch(error=>message(error.message)));
  byId('more').addEventListener('click',async event=>{
    event.target.disabled=true;
    try { await load(true); } catch(error) { message(error.message); } finally { event.target.disabled=false; }
  });
  byId('logout').addEventListener('click',async()=>{
    try { await api('/api/auth/logout',{method:'POST'}); signedOut(); message('Вы вышли.'); } catch(error) { message(error.message); }
  });
  api('/api/auth/session').then(async()=>{loginPanel.hidden=true;app.hidden=false;await load();}).catch(error=>{signedOut();message(error.message);});
})();
