import { createAdminClient } from './admin-client.mjs';

const byId = id => document.getElementById(id);
const notice = byId('notice');
const list = byId('list');
const detail = byId('detail');
const loginPanel = byId('login-panel');
const loginForm = byId('login-form');
const app = byId('app');
const search = byId('request-search');
const statusFilter = byId('status-filter');
const refresh = byId('refresh');
const more = byId('more');
const logout = byId('logout');
const statuses = {
  new: 'Новая',
  diagnostics: 'Диагностика',
  approval: 'Согласование',
  repair: 'В ремонте',
  ready: 'Готова',
  closed: 'Закрыта',
};
const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Moscow' });
const pageSize = 50;
let client;
let rows = [];
let selected = null;
let hasMore = false;
let listLoaded = false;
let listRequest;
let detailRequest;
let sessionVersion = 0;

function adminClient() {
  if (typeof window.ROSEEN_API_BASE !== 'string') throw new Error('Настройка сервиса не загрузилась. Обновите страницу.');
  return client ||= createAdminClient(window.ROSEEN_API_BASE);
}

// Old versions persisted tokens here. Current compatibility tokens stay in memory.
try { localStorage.removeItem('roseen_token'); } catch { /* Storage can be disabled. */ }

function message(text, kind = '') {
  notice.textContent = text;
  notice.dataset.kind = kind;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function statusOptions(select, currentStatus) {
  for (const [value, label] of Object.entries(statuses)) {
    const option = element('option', label);
    option.value = value;
    option.selected = value === currentStatus;
    select.append(option);
  }
}
statusOptions(statusFilter);

function clearDetail() {
  selected = null;
  delete detail.dataset.open;
  detail.replaceChildren(element('p', 'Выберите заявку из списка.', 'admin-empty'));
}

function signedOut({ focus = false } = {}) {
  sessionVersion++;
  client?.clearSession();
  listRequest?.abort();
  detailRequest?.abort();
  listRequest = detailRequest = undefined;
  rows = [];
  hasMore = listLoaded = false;
  app.hidden = true;
  loginPanel.hidden = false;
  loginForm.reset();
  list.replaceChildren();
  list.removeAttribute('aria-busy');
  detail.removeAttribute('aria-busy');
  byId('list-count').textContent = '';
  search.value = '';
  statusFilter.value = '';
  refresh.disabled = more.disabled = false;
  more.hidden = true;
  clearDetail();
  if (focus) byId('email').focus();
}

function requireSession(response, version) {
  if (version !== sessionVersion) throw new DOMException('Сессия завершена.', 'AbortError');
  if (response.status === 401) {
    signedOut({ focus: true });
    message('Сессия завершилась. Войдите снова.', 'error');
    throw new DOMException('Сессия завершена.', 'AbortError');
  }
}

async function api(path, options) {
  const version = sessionVersion;
  const response = await adminClient().request(path, options);
  requireSession(response, version);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Сервис не ответил. Повторите позже.');
  return data;
}

function handleError(error) {
  if (error.name !== 'AbortError') message(error.message, 'error');
}

function normalize(value) {
  return String(value ?? '').toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replaceAll('№', '').trim();
}

function formatDate(value) {
  if (!value) return 'Дата не указана';
  const timestamp = /^\d{4}-\d{2}-\d{2} /.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Дата не указана' : dateFormat.format(date) + ' МСК';
}

function requestCard(row) {
  const id = String(row.id);
  const card = element('button', undefined, 'request-card');
  card.type = 'button';
  card.dataset.id = id;
  card.setAttribute('aria-pressed', String(selected === id));
  const header = element('span', undefined, 'request-card-heading');
  header.append(element('strong', 'Заявка №' + id), element('span', statuses[row.status] || row.status, 'request-state'));
  card.append(header,
    element('span', [row.equipment_type, row.model].filter(Boolean).join(' · ')),
    element('span', String(row.problem ?? '').slice(0, 180), 'request-summary'),
    element('span', formatDate(row.created_at) + ' · Вложений: ' + row.files_count, 'request-meta'));
  return card;
}

function renderList() {
  const terms = normalize(search.value).split(/\s+/).filter(Boolean);
  const filtered = rows.filter(row => {
    if (statusFilter.value && row.status !== statusFilter.value) return false;
    const searchable = [row.id, row.equipment_type, row.model, row.contact, row.problem].map(normalize).join(' ');
    return terms.every(term => searchable.includes(term));
  });
  const cards = document.createDocumentFragment();
  for (const row of filtered) cards.append(requestCard(row));
  list.replaceChildren(cards);
  if (!filtered.length) {
    const empty = rows.length
      ? hasMore ? 'Среди загруженных заявок совпадений нет.' : 'По этим условиям заявок нет.'
      : 'Заявок пока нет.';
    list.append(element('p', empty, 'admin-empty'));
  }
  byId('list-count').textContent = hasMore
    ? 'Показано: ' + filtered.length + ' из ' + rows.length + ' загруженных'
    : 'Показано: ' + filtered.length + ' из ' + rows.length;
  more.hidden = !hasMore;
}

async function load(append = false) {
  if (listRequest || (append && !hasMore)) return;
  const request = new AbortController();
  listRequest = request;
  list.setAttribute('aria-busy', 'true');
  refresh.disabled = more.disabled = true;
  if (!listLoaded) list.replaceChildren(element('p', 'Загружаем заявки…', 'admin-empty'));
  try {
    const cursor = append ? '?before=' + encodeURIComponent(rows.at(-1).id) : '';
    const received = await api('/api/requests' + cursor, { signal: request.signal });
    if (request.signal.aborted) return;
    if (!Array.isArray(received)) throw new Error('Сервис не вернул список заявок. Повторите позже.');
    rows = append ? rows.concat(received) : received;
    hasMore = !adminClient().isLegacy() && received.length === pageSize;
    listLoaded = true;
    renderList();
  } catch (error) {
    if (!listLoaded && !request.signal.aborted) list.replaceChildren(element('p', 'Список пока недоступен.', 'admin-empty'));
    throw error;
  } finally {
    if (listRequest === request) {
      listRequest = undefined;
      list.removeAttribute('aria-busy');
      refresh.disabled = more.disabled = false;
    }
  }
}

async function download(id, name, button) {
  const version = sessionVersion;
  button.disabled = true;
  try {
    const response = await adminClient().request('/api/files/' + encodeURIComponent(id));
    requireSession(response, version);
    if (!response.ok) throw new Error('Не удалось скачать файл. Повторите позже.');
    const blob = await response.blob();
    if (version !== sessionVersion) return;
    const url = URL.createObjectURL(blob);
    const link = element('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    button.disabled = false;
  }
}

function textField(id, label, control) {
  const field = element('div', undefined, 'field');
  const caption = element('label', label);
  caption.htmlFor = control.id = id;
  field.append(caption, control);
  return field;
}

function renderDetail(row) {
  const id = String(row.id);
  selected = id;
  for (const card of list.querySelectorAll('.request-card')) {
    card.setAttribute('aria-pressed', String(card.dataset.id === id));
  }
  const heading = element('h2', 'Заявка №' + id);
  heading.tabIndex = -1;
  const back = element('button', 'К списку заявок', 'btn btn-ghost admin-detail-back');
  back.type = 'button';
  back.addEventListener('click', () => {
    clearDetail();
    renderList();
    const opener = [...list.querySelectorAll('.request-card')].find(card => card.dataset.id === id);
    (opener || search).focus();
  });
  const metadata = element('dl');
  for (const [label, value] of [
    ['Техника', row.equipment_type], ['Модель', row.model], ['Контакт', row.contact],
    ['Получена', formatDate(row.created_at)], ['Неисправность', row.problem],
  ]) {
    const item = element('div', undefined, label === 'Неисправность' ? 'request-description' : undefined);
    item.append(element('dt', label), element('dd', value || 'Не указано'));
    metadata.append(item);
  }
  const form = element('form');
  const status = element('select');
  statusOptions(status, row.status);
  const comment = element('textarea', undefined, 'request-comment');
  comment.maxLength = 5000;
  comment.value = row.comment || '';
  const save = element('button', 'Сохранить', 'btn btn-primary');
  save.type = 'submit';
  const saveNote = element('p', '', 'admin-notice');
  saveNote.hidden = true;
  form.append(textField('request-status', 'Статус', status),
    textField('request-comment', 'Комментарий инженера', comment), save, saveNote);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (save.disabled) return;
    const version = sessionVersion;
    save.disabled = true;
    saveNote.hidden = true;
    try {
      const updated = await api('/api/requests/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status.value, comment: comment.value }),
      });
      if (version !== sessionVersion) return;
      if (!updated || String(updated.id) !== id) throw new Error('Сервис не подтвердил сохранение. Обновите список.');
      listRequest?.abort();
      rows = rows.map(item => String(item.id) === id ? { ...item, ...updated } : item);
      if (listLoaded) renderList();
      const saved = 'Заявка №' + id + ' обновлена.';
      message(saved, 'success');
      saveNote.textContent = saved;
      saveNote.dataset.kind = 'success';
      saveNote.hidden = false;
    } catch (error) {
      handleError(error);
      if (error.name !== 'AbortError') {
        saveNote.textContent = error.message;
        saveNote.dataset.kind = 'error';
        saveNote.hidden = false;
      }
    } finally {
      save.disabled = false;
    }
  });

  detail.replaceChildren(back, heading, metadata, form, element('h3', 'Вложения'));
  for (const file of row.files) {
    const line = element('div', undefined, 'file-row');
    const button = element('button', 'Скачать', 'btn btn-ghost');
    button.type = 'button';
    button.setAttribute('aria-label', 'Скачать файл ' + file.original_name);
    button.addEventListener('click', () => download(file.id, file.original_name, button).catch(handleError));
    line.append(element('span', file.original_name + ' · ' + Math.max(1, Math.round(file.size / 1024)) + ' КБ'), button);
    detail.append(line);
  }
  if (!row.files.length) detail.append(element('p', 'Нет вложений.', 'admin-empty'));
  detail.dataset.open = '';
  heading.focus();
}

async function open(id) {
  detailRequest?.abort();
  const request = new AbortController();
  detailRequest = request;
  detail.setAttribute('aria-busy', 'true');
  try {
    const row = await api('/api/requests/' + encodeURIComponent(id), { signal: request.signal });
    if (request.signal.aborted) return;
    if (!row || String(row.id) !== id || !Array.isArray(row.files)) throw new Error('Сервис не вернул карточку заявки.');
    renderDetail(row);
    message('');
  } finally {
    if (detailRequest === request) {
      detailRequest = undefined;
      detail.removeAttribute('aria-busy');
    }
  }
}

function showApp() {
  loginPanel.hidden = true;
  app.hidden = false;
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = loginForm.querySelector('button');
  if (button.disabled) return;
  button.disabled = true;
  try {
    await adminClient().login(byId('email').value, byId('password').value);
    loginForm.reset();
    showApp();
    message('Вход выполнен.', 'success');
    search.focus();
    await load();
  } catch (error) {
    handleError(error);
  } finally {
    button.disabled = false;
  }
});

list.addEventListener('click', event => {
  const card = event.target.closest('.request-card');
  if (card) open(card.dataset.id).catch(handleError);
});
search.addEventListener('input', () => { if (listLoaded) renderList(); });
statusFilter.addEventListener('change', () => { if (listLoaded) renderList(); });
refresh.addEventListener('click', () => { message(''); load().catch(handleError); });
more.addEventListener('click', () => load(true).catch(handleError));
logout.addEventListener('click', async () => {
  logout.disabled = true;
  try {
    await adminClient().logout();
    signedOut({ focus: true });
    message('Вы вышли.');
  } catch (error) {
    handleError(error);
  } finally {
    logout.disabled = false;
  }
});

message('Проверяем доступ…');
try {
  if (await adminClient().restoreSession()) {
    showApp();
    message('');
    await load();
  } else {
    signedOut();
    message('');
  }
} catch (error) {
  if (app.hidden && loginPanel.hidden) signedOut();
  handleError(error);
}
