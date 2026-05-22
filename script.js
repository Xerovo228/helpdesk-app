// ============================================
// ИНТЕЛЛЕКТУАЛЬНЫЙ SERVICE DESK
// Telegram Mini App + ИИ + Блокировка + Вкладки
// ============================================

let tg = window.Telegram.WebApp;
tg.expand();

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyqo324EO8jZ42kIEYzyO8A69hnElcPcR4-Rj35-SvVDdfx0hhhXUlxLp9GCN8LVCqTOg/exec";

let currentRole = 'student';
let currentFilter = 'all';
let allTicketsData = [];
let user = tg.initDataUnsafe?.user;
let currentAdminTab = 'tickets';

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
            loadBlockedUsers();
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
    if (view === 'admin') {
        loadTickets();
        loadBlockedUsers();
    }
    if (view === 'student') loadUserTickets();
}

window.showAdminTab = function(tab) {
    currentAdminTab = tab;
    
    const ticketsTab = document.getElementById('ticketsTab');
    const blockedTab = document.getElementById('blockedTab');
    const ticketsBtn = document.getElementById('tabTicketsBtn');
    const blockedBtn = document.getElementById('tabBlockedBtn');
    
    if (tab === 'tickets') {
        ticketsTab.style.display = 'block';
        blockedTab.style.display = 'none';
        ticketsBtn.classList.add('admin-tab-active');
        blockedBtn.classList.remove('admin-tab-active');
        renderTicketsByFilter();
    } else {
        ticketsTab.style.display = 'none';
        blockedTab.style.display = 'block';
        blockedBtn.classList.add('admin-tab-active');
        ticketsBtn.classList.remove('admin-tab-active');
        loadBlockedUsers();
    }
};

async function loadTickets() {
    const list = document.getElementById('ticketsList');
    const stats = document.getElementById('adminStats');
    list.innerHTML = "<p style='text-align:center;'>🔄 Обновление...</p>";

    try {
        const res = await apiRequest({ action: "get_tickets" });
        allTicketsData = res.tickets || [];
        
        let itCount = 0, ahchCount = 0, networkCount = 0;
        allTicketsData.forEach(t => {
            if (t.aiCategory === 'IT') itCount++;
            else if (t.aiCategory === 'АХЧ') ahchCount++;
            else if (t.aiCategory === 'Сеть') networkCount++;
        });
        
        stats.innerHTML = `📝 Всего: <b>${allTicketsData.length}</b> | 💻 IT: <b>${itCount}</b> | 🔧 АХЧ: <b>${ahchCount}</b> | 🌐 Сеть: <b>${networkCount}</b>`;
        
        if (currentAdminTab === 'tickets') {
            renderTicketsByFilter();
        }
        
    } catch (e) {
        stats.innerHTML = "❌ Ошибка связи";
        console.error(e);
    }
}

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
        
        // Экранируем имя для передачи в функцию
        const safeUserName = (t.userName || "Пользователь").replace(/'/g, "\\'");
        const safeUserId = t.userId || "";
        
        const hasValidUserId = safeUserId && safeUserId !== "null" && safeUserId !== "" && safeUserId !== "?";
        
        const aiBlock = `
            <div class="ai-diagnostic">
                <div class="ai-diagnostic-title">🤖 ИИ-диагностика:</div>
                <div class="ai-diagnostic-text">📁 Категория: ${categoryEmoji[t.aiCategory] || '📁'} ${t.aiCategory || 'IT'}</div>
                <div class="ai-diagnostic-text">⚡ Приоритет: ${priorityText[t.aiPriority] || '⚠️ Средний'}</div>
            </div>
        `;
        
        card.innerHTML = `
            <div><b>ID: ${t.id}</b> | 🚪 Каб: ${t.room} | 👤 ${t.userName || "Неизвестный"} (ID: ${safeUserId || "?"})</div>
            <div style="margin: 8px 0; font-size: 15px;">${t.problem}</div>
            ${aiBlock}
            <div class="card-actions">
                ${t.photoUrl !== "❌ Нет фото" && t.photoUrl !== "No photo" ? `<a href="${t.photoUrl}" target="_blank" class="btn-view">📸 Фото</a>` : '<span class="btn-view" style="opacity:0.5;">📷 Нет фото</span>'}
                ${isProcessing
                    ? `<button class="btn-done" onclick="closeTicket(${t.row}, this)">✅ Готово</button>`
                    : `<button class="btn-take" onclick="takeTicket(${t.row}, this)">🔧 В работу</button>`
                }
                ${hasValidUserId 
                    ? `<button class="btn-block" onclick="showBlockDialog('${safeUserId}', '${safeUserName}')">🚫 Блок</button>`
                    : `<button class="btn-block" style="background: #6c757d !important; cursor: not-allowed;" disabled title="ID пользователя не найден">🚫 Блок (нет ID)</button>`
                }
            </div>
        `;
        list.appendChild(card);
    });
}

async function loadBlockedUsers() {
    const list = document.getElementById('blockedList');
    if (!list) return;
    
    list.innerHTML = "<p style='text-align:center;'>🔄 Загрузка списка заблокированных...</p>";
    
    try {
        const res = await apiRequest({ action: 'get_blocked_users', adminId: user.id });
        
        if (res.status !== 'success' || !res.blockedUsers || res.blockedUsers.length === 0) {
            list.innerHTML = "<p style='text-align:center; padding: 20px;'>🚫 Нет заблокированных пользователей</p>";
            return;
        }
        
        list.innerHTML = "";
        
        res.blockedUsers.forEach(blocked => {
            const hasValidId = blocked.telegramId && blocked.telegramId !== "" && blocked.telegramId !== "null";
            const card = document.createElement('div');
            card.className = 'blocked-card';
            let formattedDate = blocked.date || "Дата не указана";
            if (formattedDate && formattedDate.includes('T')) {
                formattedDate = formattedDate.replace('T', ' ').substring(0, 16);
            }
            card.innerHTML = `
                <div><b>👤 ${blocked.userName || "Неизвестный"}</b> | 🆔 ${blocked.telegramId || "?"}</div>
                <div style="margin: 8px 0; font-size: 13px; color: #666;">📅 Заблокирован: ${formattedDate}</div>
                <div style="margin: 8px 0; font-size: 13px; background: #f8d7da; padding: 8px; border-radius: 10px;">
                    📝 <b>Причина:</b> ${blocked.reason || "Не указана"}
                </div>
                <div style="margin: 8px 0; font-size: 12px; color: #666;">👮 Заблокировал: ${blocked.blockedBy || "Администратор"}</div>
                <div class="card-actions">
                    ${hasValidId
                        ? `<button class="btn-unblock" onclick="unblockUser('${blocked.telegramId}', '${blocked.userName.replace(/'/g, "\\'")}')">🔓 Разблокировать</button>`
                        : `<button class="btn-unblock" style="background: #6c757d !important; cursor: not-allowed;" disabled>🔓 Разблокировать (нет ID)</button>`
                    }
                </div>
            `;
            list.appendChild(card);
        });
        
    } catch (e) {
        list.innerHTML = "❌ Ошибка загрузки списка";
        console.error(e);
    }
}

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

// ========== БЛОКИРОВКА: РАБОТА С МОДАЛЬНЫМ ОКНОМ ==========
window.showBlockDialog = function(userId, userName) {
    // Проверка валидности ID
    if (!userId || userId === "" || userId === "?" || userId === "null" || userId === "undefined") {
        tg.showPopup({
            title: 'Ошибка',
            message: '❌ Не удалось определить ID пользователя.\n\nПроверьте, что в таблице Tickets колонка C заполнена.',
            buttons: [{ type: 'ok' }]
        });
        return;
    }
    
    // Сохраняем данные в скрытые поля модального окна
    document.getElementById('blockUserId').value = String(userId).trim();
    document.getElementById('blockUserDisplayName').value = userName || "Пользователь";
    
    // Отображаем информацию в модалке
    const userNameSpan = document.getElementById('blockUserName');
    userNameSpan.innerText = 'Пользователь: ' + userName + ' (ID: ' + userId + ')';
    
    // Очищаем поле причины
    document.getElementById('blockReason').value = '';
    
    // Показываем модальное окно
    document.getElementById('blockModal').style.display = 'flex';
};

window.closeBlockModal = function() {
    document.getElementById('blockModal').style.display = 'none';
    // НЕ ОБНУЛЯЕМ скрытые поля — они сохраняются для отправки
};

window.confirmBlock = async function() {
    const reason = document.getElementById('blockReason').value.trim();
    if (reason === "") {
        tg.showPopup({
            title: 'Ошибка',
            message: 'Пожалуйста, укажите причину блокировки!',
            buttons: [{ type: 'ok' }]
        });
        return;
    }
    
    // Берём данные из скрытых полей (они сохраняются даже после закрытия модалки)
    const targetId = document.getElementById('blockUserId').value;
    const targetName = document.getElementById('blockUserDisplayName').value;
    
    if (!targetId || targetId === "" || targetId === "null") {
        tg.showPopup({
            title: 'Ошибка',
            message: '❌ Не удалось определить пользователя для блокировки. ID отсутствует.',
            buttons: [{ type: 'ok' }]
        });
        closeBlockModal();
        return;
    }
    
    // Закрываем модалку
    closeBlockModal();
    
    try {
        const res = await apiRequest({
            action: 'block_user',
            adminId: user.id,
            targetId: targetId,
            userName: targetName,
            reason: reason,
            adminName: user?.first_name || user?.username || "Администратор"
        });
        
        if (res.status === 'success') {
            tg.showPopup({
                title: '✅ Заблокирован',
                message: 'Пользователь ' + targetName + ' (ID: ' + targetId + ') заблокирован.\nПричина: ' + reason,
                buttons: [{ type: 'ok' }]
            });
            loadTickets();
            loadBlockedUsers();
        } else {
            throw new Error(res.error || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Block error:', error);
        tg.showPopup({
            title: 'Ошибка',
            message: 'Не удалось заблокировать пользователя: ' + error.message,
            buttons: [{ type: 'ok' }]
        });
    }
};

// ========== РАЗБЛОКИРОВКА ==========
window.unblockUser = async function(userId, userName) {
    if (!userId || userId === "" || userId === "?" || userId === "null" || userId === "undefined") {
        tg.showPopup({
            title: 'Ошибка',
            message: '❌ Не удалось определить ID пользователя для разблокировки.',
            buttons: [{ type: 'ok' }]
        });
        return;
    }
    
    tg.showPopup({
        title: 'Разблокировка',
        message: 'Разблокировать пользователя ' + userName + ' (ID: ' + userId + ')?',
        buttons: [
            { type: 'cancel', text: 'Отмена' },
            { type: 'default', text: 'Разблокировать' }
        ]
    }, async function(buttonIndex) {
        if (buttonIndex === 1) {
            try {
                const res = await apiRequest({
                    action: 'unblock_user',
                    adminId: user.id,
                    targetId: userId
                });
                
                if (res.status === 'success') {
                    tg.showPopup({
                        title: '✅ Разблокирован',
                        message: 'Пользователь ' + userName + ' разблокирован.',
                        buttons: [{ type: 'ok' }]
                    });
                    loadTickets();
                    loadBlockedUsers();
                } else {
                    throw new Error(res.error || 'Неизвестная ошибка');
                }
            } catch (error) {
                console.error('Unblock error:', error);
                tg.showPopup({
                    title: 'Ошибка',
                    message: 'Не удалось разблокировать пользователя: ' + error.message,
                    buttons: [{ type: 'ok' }]
                });
            }
        }
    });
};

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
                    } else if (result.error) {
                        tg.showPopup({
                            title: '⚠️ Ошибка',
                            message: result.error,
                            buttons: [{ type: 'ok' }]
                        });
                        btn.disabled = false;
                        btn.innerText = "Отправить";
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
