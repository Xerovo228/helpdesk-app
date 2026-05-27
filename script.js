// ============================================
// ИНТЕЛЛЕКТУАЛЬНЫЙ SERVICE DESK
// Telegram Mini App + ИИ + Блокировка + Вкладки + Верификация 🔒
// ============================================

let tg = window.Telegram.WebApp;
tg.expand();

// Автоматически включаем кнопку "Назад", если она понадобится
tg.BackButton.hide();

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxPQ7vWcvAjk6e2DbSPkzxbLIWVsNMU4tOuoLTZZ9RR37VphWTMSU-NgKaP7pRcXQTozw/exec";

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

// ========== ОБНОВЛЕННАЯ ФУНКЦИЯ ПРОВЕРКИ РОЛИ ==========
async function checkRole() {
    try {
        const res = await apiRequest({ action: "check_role", telegramId: user ? user.id : 0 });
        
        if (res.role === 'blocked') {
            showView('blocked_screen'); // Если забанен
            return;
        }
        
        if (res.role === 'unauthenticated') {
            showView('auth_screen'); // ЕСЛИ НЕТ ТЕЛЕФОНА — отправляем на экран верификации
            return;
        }

        if (res.role === 'admin') {
            document.getElementById('roleSwitcher').style.display = 'block';
            showView('admin');
            loadBlockedUsers();
        } else {
            showView('student'); // Если обычный студент с подтвержденным телефоном
        }
    } catch (e) {
        showView('student');
    }
}

window.toggleRole = function() {
    showView(currentRole === 'admin' ? 'student' : 'admin');
};

// ========== ИЗМЕНЕННАЯ УПРАВЛЯЮЩАЯ ФУНКЦИЯ ЭКРАНОВ ==========
function showView(view) {
    currentRole = view;
    
    // Элементы экранов
    const studentView = document.getElementById('studentView');
    const adminView = document.getElementById('adminView');
    const authScreen = document.getElementById('authScreen');
    const blockedScreen = document.getElementById('blockedScreen');

    if(studentView) studentView.style.display = view === 'student' ? 'block' : 'none';
    if(adminView) adminView.style.display = view === 'admin' ? 'block' : 'none';
    if(authScreen) authScreen.style.display = view === 'auth_screen' ? 'block' : 'none';
    if(blockedScreen) blockedScreen.style.display = view === 'blocked_screen' ? 'block' : 'none';
    
    if (view === 'admin') {
        loadTickets();
        loadBlockedUsers();
    }
    if (view === 'student') {
        loadUserTickets();
    }
}

// ========== ЗАПРОС КОНТАКТА ИЗ TELEGRAM ==========
window.requestPhone = function() {
    tg.requestContact(async function(authData) {
        if (authData && authData.status === 'sent' && authData.response) {
            const btn = document.getElementById('authBtn');
            if (btn) {
                btn.disabled = true;
                btn.innerText = "⏳ Сохранение номера...";
            }
            await sendPhoneToServer(authData.contact?.phone_number || "");
        } else {
            tg.showPopup({
                title: '⚠️ Авторизация отклонена',
                message: 'Чтобы продолжить, необходимо разрешить доступ к номеру телефона.',
                buttons: [{ type: 'ok' }]
            });
        }
    });
};

// Отправка подтвержденного телефона на Google Apps Script
async function sendPhoneToServer(phoneNumber) {
    try {
        const result = await apiRequest({
            action: "save_phone",
            telegramId: user ? user.id : 0,
            phone: phoneNumber || "Подтвержден через Mini App"
        });
        
        if (result.status === 'success') {
            tg.showPopup({
                title: '🎉 Успешно!',
                message: 'Номер телефона подтвержден. Теперь вы можете создавать заявки!',
                buttons: [{ type: 'ok' }]
            });
            checkRole();
        } else {
            throw new Error(result.error || "Ошибка сохранения");
        }
    } catch (error) {
        tg.showPopup({
            title: '❌ Ошибка сервера',
            message: 'Не удалось привязать телефон. Попробуйте еще раз.',
            buttons: [{ type: 'ok' }]
        });
        const btn = document.getElementById('authBtn');
        if (btn) {
            btn.disabled = false;
            btn.innerText = "📱 Подтвердить телефон";
        }
    }
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
    if (!list) return;
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
        
        if (stats) {
            stats.innerHTML = `📝 Всего: <b>${allTicketsData.length}</b> | 💻 IT: <b>${itCount}</b> | 🔧 АХЧ: <b>${ahchCount}</b> | 🌐 Сеть: <b>${networkCount}</b>`;
        }
        
        if (currentAdminTab === 'tickets') {
            renderTicketsByFilter();
        }
        
    } catch (e) {
        if (stats) stats.innerHTML = "❌ Ошибка связи";
        console.error(e);
    }
}

function renderTicketsByFilter() {
    const list = document.getElementById('ticketsList');
    if (!list) return;
    
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
                ${t.photoUrl !== "❌ Нет фото" && t.photoUrl !== "No photo" && t.photoUrl !== "Нет фото" ? `<a href="${t.photoUrl}" target="_blank" class="btn-view">📸 Фото</a>` : '<span class="btn-view" style="opacity:0.5;">📷 Нет фото</span>'}
                ${isProcessing
                    ? `<button class="btn-done" onclick="closeTicket(${t.row}, this)">✅ Готово</button>`
                    : `<button class="btn-take" onclick="takeTicket(${t.row}, this)">🔧 В работе</button>`
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
        const res = await apiRequest({ action: 'get_blocked_users', adminId: user ? user.id : 0 });
        // ИСПРАВЛЕНО: Читаем корректное поле res.blocked, которое отправляет бэкенд
        if (res.status !== 'success' || !res.blocked || res.blocked.length === 0) {
            list.innerHTML = "<p style='text-align:center; padding: 20px;'>🚫 Нет заблокированных пользователей</p>";
            return;
        }
        list.innerHTML = "";
        
        res.blocked.forEach(blocked => {
            const hasValidId = blocked.telegramId && blocked.telegramId !== "" && blocked.telegramId !== "null";
            const card = document.createElement('div');
            card.className = 'blocked-card';
            let formattedDate = blocked.date || "Дата не указана";
            if (formattedDate && formattedDate.includes('T')) {
                formattedDate = formattedDate.replace('T', ' ').substring(0, 16);
            }
            card.innerHTML = `
                <div><b>👤 ${blocked.userName || "Неизвестный"}</b> | 🆔 ${blocked.telegramId || "?"}</div>
                <div style="margin: 4px 0 8px 0; font-size: 13px; color: #888;">📅 Заблокирован: ${formattedDate}</div>
                <div style="margin: 8px 0; font-size: 14px; color: var(--tg-theme-text-color, #222); background: var(--tg-theme-secondary-bg-color, #f4f4f5); padding: 10px 14px; border-radius: 12px; border: 1px solid rgba(0, 0, 0, 0.08); word-break: break-word;">
                    <span style="color: #e53935; font-weight: bold;">🚫 Причина:</span> ${blocked.reason || "Не указана"}
                </div>
                <div style="margin: 8px 0 4px 0; font-size: 12px; color: #888;">👮 Заблокировал: ${blocked.adminName || "Администратор"}</div>
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

window.filterAll = function() { currentFilter = 'all'; renderTicketsByFilter(); highlightFilter('all'); };
window.filterIT = function() { currentFilter = 'IT'; renderTicketsByFilter(); highlightFilter('IT'); };
window.filterAHCH = function() { currentFilter = 'АХЧ'; renderTicketsByFilter(); highlightFilter('АХЧ'); };
window.filterNetwork = function() { currentFilter = 'Сеть'; renderTicketsByFilter(); highlightFilter('Сеть'); };

window.showBlockDialog = function(userId, userName) {
    if (!userId || userId === "" || userId === "?" || userId === "null" || userId === "undefined") {
        tg.showPopup({
            title: 'Ошибка', message: '❌ Не удалось определить ID пользователя.\n\nПроверьте, что в таблице Tickets колонка C заполнена.', buttons: [{ type: 'ok' }]
        });
        return;
    }
    document.getElementById('blockUserId').value = String(userId).trim();
    document.getElementById('blockUserDisplayName').value = userName || "Пользователь";
    const userNameSpan = document.getElementById('blockUserName');
    if (userNameSpan) userNameSpan.innerText = 'Пользователь: ' + userName + ' (ID: ' + userId + ')';
    document.getElementById('blockReason').value = '';
    document.getElementById('blockModal').style.display = 'flex';
};

window.closeBlockModal = function() { document.getElementById('blockModal').style.display = 'none'; };

window.confirmBlock = async function() {
    const reason = document.getElementById('blockReason').value.trim();
    if (reason === "") {
        tg.showPopup({ title: 'Ошибка', message: 'Пожалуйста, укажите причину блокировки!', buttons: [{ type: 'ok' }] });
        return;
    }
    const targetId = document.getElementById('blockUserId').value;
    const targetName = document.getElementById('blockUserDisplayName').value;
    if (!targetId || targetId === "" || targetId === "null") {
        tg.showPopup({ title: 'Ошибка', message: '❌ Не удалось определить пользователя для блокировки. ID отсутствует.', buttons: [{ type: 'ok' }] });
        closeBlockModal();
        return;
    }
    closeBlockModal();
    try {
        const res = await apiRequest({
            action: 'block_user', adminId: user ? user.id : 0, targetId: targetId, userName: targetName, reason: reason, adminName: user?.first_name || user?.username || "Администратор"
        });
        if (res.status === 'success') {
            tg.showPopup({ title: '✅ Заблокирован', message: 'Пользователь ' + targetName + ' (ID: ' + targetId + ') заблокирован.', buttons: [{ type: 'ok' }] });
            loadTickets(); loadBlockedUsers();
        } else { throw new Error(res.error || 'Неизвестная ошибка'); }
    } catch (error) {
        console.error('Block error:', error);
        tg.showPopup({ title: 'Ошибка', message: 'Не удалось заблокировать пользователя: ' + error.message, buttons: [{ type: 'ok' }] });
    }
};

window.unblockUser = async function(userId, userName) {
    if (!userId || userId === "" || userId === "?" || userId === "null" || userId === "undefined") {
        tg.showPopup({ title: 'Ошибка', message: '❌ Не удалось определить ID пользователя для разблокировки.', buttons: [{ type: 'ok' }] });
        return;
    }
    tg.showPopup({
        title: 'Разблокировка', message: 'Разблокировать пользователя ' + userName + ' (ID: ' + userId + ')?',
        buttons: [ { id: 'cancel', type: 'cancel', text: 'Отмена' }, { id: 'ok', type: 'default', text: 'Разблокировать' } ]
    }, async function(buttonId) {
        if (buttonId === 'ok') {
            try {
                const res = await apiRequest({ action: 'unblock_user', adminId: user ? user.id : 0, targetId: userId });
                if (res.status === 'success') {
                    tg.showPopup({ title: '✅ Разблокирован', message: 'Пользователь ' + userName + ' успешно разблокирован.', buttons: [{ type: 'ok' }] });
                    loadTickets(); loadBlockedUsers();
                } else { throw new Error(res.error || 'Неизвестная ошибка'); }
            } catch (error) {
                tg.showPopup({ title: 'Ошибка', message: 'Не удалось разблокировать пользователя: ' + error.message, buttons: [{ type: 'ok' }] });
            }
        }
    });
};

async function loadUserTickets() {
    const list = document.getElementById('userTicketsList');
    if(!list) return;
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

// ИСПРАВЛЕНО: action изменен на update_ticket_status для синхронизации с бэкендом
window.takeTicket = async function(row, btn) {
    btn.disabled = true; btn.innerText = "⏳...";
    try {
        await apiRequest({ action: "update_ticket_status", row: row, status: "🔧 В работе" });
        loadTickets();
    } catch (e) { btn.disabled = false; btn.innerText = "❌ Ошибка"; }
};

// ИСПРАВЛЕНО: action изменен на update_ticket_status для синхронизации с бэкендом
window.closeTicket = async function(row, btn) {
    btn.disabled = true; btn.innerText = "⏳...";
    try {
        await apiRequest({ action: "update_ticket_status", row: row, status: "🟢 Готово" });
        loadTickets();
    } catch (e) { btn.disabled = false; btn.innerText = "❌ Ошибка"; }
};

window.addEventListener('load', () => {
    const ticketForm = document.getElementById('ticketForm');
    const fileInput = document.getElementById('photo');
    const fileNameDisplay = document.getElementById('fileName');

    if (fileInput && fileNameDisplay) {
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

            const fileInputEl = document.getElementById('photo');
            
            if (fileInputEl && fileInputEl.files.length > 0) {
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
                                title: '✅ Отправлено!', message: 'Заявка создана. Администратор скоро свяжется с вами.', buttons: [{ type: 'ok' }]
                            });
                            setTimeout(() => tg.close(), 1500);
                        } else if (result.error) {
                            tg.showPopup({ title: '⚠️ Ошибка', message: result.error, buttons: [{ type: 'ok' }] });
                            btn.disabled = false; btn.innerText = "Отправить";
                        } else { throw new Error('Ошибка сервера'); }
                    } catch (error) {
                        btn.disabled = false; btn.innerText = "❌ Ошибка отправки";
                        tg.showPopup({ title: '⚠️ Ошибка', message: 'Не удалось отправить заявку. Попробуйте позже.', buttons: [{ type: 'ok' }] });
                    }
                };
                reader.readAsDataURL(fileInputEl.files[0]);
            } else {
                // Если фото нет — отправляем заявку пустой строкой вместо файла
                try {
                    const result = await apiRequest({
                        action: "create_ticket",
                        user: user?.username ? `@${user.username}` : (user?.first_name || "Аноним"),
                        telegramId: user ? user.id : 0,
                        room: document.getElementById('room').value,
                        problem: document.getElementById('problem').value,
                        photo: ""
                    });
                    if (result.status === 'success') {
                        tg.showPopup({ title: '✅ Отправлено!', message: 'Заявка создана.', buttons: [{ type: 'ok' }] });
                        setTimeout(() => tg.close(), 1500);
                    } else {
                        tg.showPopup({ title: '⚠️ Ошибка', message: result.error || 'Ошибка', buttons: [{ type: 'ok' }] });
                        btn.disabled = false; btn.innerText = "Отправить";
                    }
                } catch(err) {
                    btn.disabled = false; btn.innerText = "Отправить";
                }
            }
        });
    }
});

checkRole();
