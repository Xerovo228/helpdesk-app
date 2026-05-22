// ============================================
// ИНТЕЛЛЕКТУАЛЬНЫЙ SERVICE DESK
// Фронтенд для Telegram Mini App
// С фильтрацией по категориям ИИ
// ============================================

let tg = window.Telegram.WebApp;
tg.expand();

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztD215U09edQ837xmYPzcCWxQTz7e7K2FIgs97e7vNbNDiTowqbzYrs9soVOWB5ApIlw/exec";

let currentRole = 'student';
let currentFilter = 'all';
let allTicketsData = [];
let user = tg.initDataUnsafe?.user;

async function apiRequest(payload) {
  const response = await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return await response.json();
}

async function checkRole() {
  try {
    const res = await apiRequest({ action: "check_role", telegramId: user ? user.id : 0 });
    if (res.role === 'admin') {
      document.getElementById('roleSwitcher').style.display = 'block';
      showView('admin');
    } else {
      showView('student');
    }
  } catch (e) {
    showView('student');
  }
}

window.toggleRole = function() {
  showView(currentRole === 'admin' ? 'student' : 'admin');
};

function showView(view) {
  currentRole = view;
  document.getElementById('studentView').style.display = view === 'student' ? 'block' : 'none';
  document.getElementById('adminView').style.display = view === 'admin' ? 'block' : 'none';
  if (view === 'admin') loadTickets();
  if (view === 'student') loadUserTickets();
}

// ========== ЗАГРУЗКА ЗАЯВОК ДЛЯ АДМИНА ==========
async function loadTickets() {
  const list = document.getElementById('ticketsList');
  const stats = document.getElementById('adminStats');
  list.innerHTML = "<p style='text-align:center;'>🔄 Обновление...</p>";

  try {
    const res = await apiRequest({ action: "get_tickets" });
    allTicketsData = res.tickets || [];
    
    // Подсчёт статистики по категориям
    let itCount = 0, ahchCount = 0, networkCount = 0;
    allTicketsData.forEach(t => {
      if (t.aiCategory === 'IT') itCount++;
      else if (t.aiCategory === 'АХЧ') ahchCount++;
      else if (t.aiCategory === 'Сеть') networkCount++;
    });
    
    stats.innerHTML = `📝 Всего: <b>${allTicketsData.length}</b> | 💻 IT: <b>${itCount}</b> | 🔧 АХЧ: <b>${ahchCount}</b> | 🌐 Сеть: <b>${networkCount}</b>`;
    
    renderTicketsByFilter();
    
  } catch (e) {
    stats.innerHTML = "❌ Ошибка связи";
    console.error(e);
  }
}

// ========== ОТРИСОВКА ЗАЯВОК С УЧЁТОМ ФИЛЬТРА ==========
function renderTicketsByFilter() {
  const list = document.getElementById('ticketsList');
  
  let filteredTickets = allTicketsData;
  if (currentFilter !== 'all') {
    filteredTickets = allTicketsData.filter(t => t.aiCategory === currentFilter);
  }
  
  if (filteredTickets.length === 0) {
    list.innerHTML = `<p style='text-align:center; padding: 20px;'>📭 Нет заявок в категории "${currentFilter === 'all' ? 'всех' : currentFilter}"</p>`;
    return;
  }
  
  list.innerHTML = "";
  const categoryEmoji = { "IT": "💻", "АХЧ": "🔧", "Сеть": "🌐" };
  const priorityText = { "high": "🔥 Высокий", "medium": "⚠️ Средний", "low": "📌 Низкий" };
  
  filteredTickets.forEach(t => {
    const card = document.createElement('div');
    card.className = 'ticket-card';
    const isProcessing = t.status === "🔧 В работе";
    
    const aiBlock = `
      <div style="background: #eef2ff; padding: 10px; border-radius: 12px; margin: 10px 0;">
        <div style="font-size: 12px; color: #4a5568; margin-bottom: 5px;">🤖 ИИ-диагностика:</div>
        <div>📁 Категория: ${categoryEmoji[t.aiCategory] || '📁'} ${t.aiCategory || 'IT'}</div>
        <div>⚡ Приоритет: ${priorityText[t.aiPriority] || '⚠️ Средний'}</div>
        <div style="margin-top: 5px;">💡 Совет: <i>${t.aiAdvice || 'Нет данных'}</i></div>
      </div>
    `;
    
    card.innerHTML = `
      <div><b>ID: ${t.id}</b> | 🚪 Каб: ${t.room}</div>
      <div style="margin: 8px 0; font-size: 15px;">${t.problem}</div>
      ${aiBlock}
      <div class="card-actions">
        ${t.photoUrl !== "❌ Нет фото" && t.photoUrl !== "No photo" ? `<a href="${t.photoUrl}" target="_blank" class="btn-view">📸 Фото</a>` : '<span class="btn-view" style="opacity:0.5;">📷 Нет фото</span>'}
        ${isProcessing
          ? `<button class="btn-done" onclick="closeTicket(${t.row}, this)">✅ Готово</button>`
          : `<button class="btn-take" onclick="takeTicket(${t.row}, this)">🔧 В работу</button>`
        }
      </div>
    `;
    list.appendChild(card);
  });
}

// ========== ФИЛЬТРАЦИЯ ПО КАТЕГОРИЯМ ==========
function highlightFilter(activeFilter) {
  const buttons = ['filterAllBtn', 'filterITBtn', 'filterAHCHBtn', 'filterNetworkBtn'];
  buttons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove('filter-btn-active');
  });
  
  let activeId = 'filterAllBtn';
  if (activeFilter === 'IT') activeId = 'filterITBtn';
  else if (activeFilter === 'АХЧ') activeId = 'filterAHCHBtn';
  else if (activeFilter === 'Сеть') activeId = 'filterNetworkBtn';
  
  const activeBtn = document.getElementById(activeId);
  if (activeBtn) activeBtn.classList.add('filter-btn-active');
}

window.filterAll = function() {
  currentFilter = 'all';
  renderTicketsByFilter();
  highlightFilter('all');
};

window.filterIT = function() {
  currentFilter = 'IT';
  renderTicketsByFilter();
  highlightFilter('IT');
};

window.filterAHCH = function() {
  currentFilter = 'АХЧ';
  renderTicketsByFilter();
  highlightFilter('АХЧ');
};

window.filterNetwork = function() {
  currentFilter = 'Сеть';
  renderTicketsByFilter();
  highlightFilter('Сеть');
};

// ========== ЗАГРУЗКА ЗАЯВОК СТУДЕНТА ==========
async function loadUserTickets() {
  const list = document.getElementById('userTicketsList');
  try {
    const res = await apiRequest({ action: "get_user_tickets", telegramId: user ? user.id : 0 });
    if (!res.tickets || res.tickets.length === 0) {
      list.innerHTML = "<p style='font-size: 13px; color: var(--tg-theme-hint-color);'>📭 Активных заявок нет</p>";
      return;
    }
    list.innerHTML = "";
    res.tickets.forEach(t => {
      const item = document.createElement('div');
      item.className = 'user-ticket-item';
      let statusColor = t.status.includes('Новая') ? '#ff4d4f' : '#faad14';
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between;">
          <span style="font-weight: 600;">№${t.id} — Каб. ${t.room}</span>
          <span style="color: ${statusColor}; font-size: 12px; font-weight: bold;">${t.status}</span>
        </div>
        <div style="font-size: 12px; margin-top: 4px; opacity: 0.8;">${t.problem}</div>
      `;
      list.appendChild(item);
    });
  } catch (e) {
    list.innerHTML = "❌ Ошибка загрузки";
    console.error(e);
  }
}

// ========== УПРАВЛЕНИЕ СТАТУСАМИ ==========
window.takeTicket = async function(row, btn) {
  btn.disabled = true;
  btn.innerText = "⏳...";
  try {
    await apiRequest({ action: "update_status", row: row, newStatus: "🔧 В работе" });
    loadTickets();
  } catch (e) {
    btn.disabled = false;
    btn.innerText = "❌ Ошибка";
  }
};

window.closeTicket = async function(row, btn) {
  btn.disabled = true;
  btn.innerText = "⏳...";
  try {
    await apiRequest({ action: "update_status", row: row, newStatus: "🟢 Готово" });
    loadTickets();
  } catch (e) {
    btn.disabled = false;
    btn.innerText = "❌ Ошибка";
  }
};

// ========== ОТПРАВКА ЗАЯВКИ ==========
window.addEventListener('load', () => {
  const ticketForm = document.getElementById('ticketForm');
  const fileInput = document.getElementById('photo');
  const fileNameDisplay = document.getElementById('fileName');

  if (fileInput) {
    fileInput.addEventListener('change', function() {
      if (this.files.length > 0) fileNameDisplay.innerText = "✅ " + this.files[0].name;
    });
  }

  if (ticketForm) {
    ticketForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.innerText = "🤖 ИИ анализирует...";

      const reader = new FileReader();
      reader.onload = async function() {
        const base64Data = reader.result.split(',')[1];
        try {
          const result = await apiRequest({
            action: "create_ticket",
            user: user?.username ? `@${user.username}` : (user?.first_name || "Аноним"),
            telegramId: user ? user.id : 0,
            room: document.getElementById('room').value,
            problem: document.getElementById('problem').value,
            photo: base64Data
          });
          
          if (result.status === 'success') {
            tg.showPopup({
              title: '✅ Отправлено!',
              message: 'Заявка создана. Администратор скоро свяжется с вами.',
              buttons: [{ type: 'ok' }]
            });
            setTimeout(() => tg.close(), 1500);
          } else {
            throw new Error('Ошибка сервера');
          }
        } catch (error) {
          btn.disabled = false;
          btn.innerText = "❌ Ошибка отправки";
          tg.showPopup({
            title: '⚠️ Ошибка',
            message: 'Не удалось отправить заявку. Попробуйте позже.',
            buttons: [{ type: 'ok' }]
          });
        }
      };
      reader.readAsDataURL(fileInput.files[0]);
    });
  }
});

checkRole();
