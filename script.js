// ============================================
// ИНТЕЛЛЕКТУАЛЬНЫЙ SERVICE DESK
// Telegram Mini App + ИИ (Gemini) + Блокировка
// ============================================

let tg = window.Telegram.WebApp;
tg.expand();
tg.BackButton.hide();

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfuDe3ApFOapPDND47Yqx_zEH3whQmQj6CC7aBhLJcuOon1clcJc3p04aJzTIwtfboaA/exec";

let currentRole = 'student';
let currentFilter = 'all';
let allTicketsData = [];
let user = tg.initDataUnsafe?.user;
let currentAdminTab = 'tickets';

async function apiRequest(payload) {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (e) {
        console.error("API Error:", e);
        return { status: 'error', error: e.message };
    }
}

function showMessage(title, message) {
    if (tg.showPopup) {
        tg.showPopup({ title: title, message: message, buttons: [{ type: 'ok' }] });
    } else {
        alert(title + "\n" + message);
    }
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
            loadUserTickets();
        }
    } catch (e) {
        console.error("CheckRole error:", e);
        showView('student');
    }
}

window.toggleRole = function() {
    if (currentRole === 'admin') {
        showView('student');
    } else if (currentRole === 'student') {
        showView('admin');
        loadTickets();
        loadBlockedUsers();
    }
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
    if (!list) return;
    
    list.innerHTML = "<p style='text-align:center;'>🔄 Загрузка заявок...</p>";
    
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
        console.error("Load tickets error:", e);
        if (stats) stats.innerHTML = "❌ Ошибка загрузки";
        list.innerHTML = "<p style='text-align:center; color: red;'>❌ Ошибка загрузки заявок</p>";
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
                <div class="ai-diagnostic-title">🤖 ИИ-диагностика (Gemini):</div>
                <div class="ai-diagnostic-text">📁 Категория: ${categoryEmoji[t.aiCategory] || '📁'} ${t.aiCategory || 'IT'}</div>
                <div class="ai-diagnostic-text">⚡ Приоритет: ${priorityText[t.aiPriority] || '⚠️ Средний'}</div>
            </div>
        `;
        
        card.innerHTML = `
            <div><b>ID: ${t.id}</b> | 🚪 Каб: ${t.room} | 👤 ${t.userName || "Неизвестный"}</div>
            <div style="margin: 8px 0; font-size: 15px;">${escapeHtml(t.problem)}</div>
            ${aiBlock}
            <div class="card-actions">
                ${t.photoUrl && t.photoUrl !== "❌ Нет фото" && t.photoUrl !== "Нет фото" ? 
                    `<a href="${t.photoUrl}" target="_blank" class="btn-view">📸 Фото</a>` : 
                    '<span class="btn-view" style="opacity:0.5;">📷 Нет фото</span>'}
                ${isProcessing
                    ? `<button class="btn-done" onclick="closeTicket(${t.row}, this)">✅ Готово</button>`
                    : `<button class="btn-take" onclick="takeTicket(${t.row}, this)">🔧 В работу</button>`
                }
                ${hasValidUserId 
                    ? `<button class="btn-block" onclick="showBlockDialog('${safeUserId}', '${safeUserName}')">🚫 Блок</button>`
                    : `<button class="btn-block" style="background: #6c757d !important; cursor: not-allowed;" disabled>🚫 Блок (нет ID)</button>`
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
                <div><b>👤 ${escapeHtml(blocked.userName || "Неизвестный")}</b> | 🆔 ${escapeHtml(blocked.telegramId || "?")}</div>
                <div style="margin: 4px 0 8px 0; font-size: 13px; color: #888;">📅 Заблокирован: ${formattedDate}</div>
                <div style="margin: 8px 0; padding: 10px; background: var(--tg-theme-secondary-bg-color, #f4f4f5); border-radius: 12px;">
                    <span style="color: #e53935; font-weight: bold;">🚫 Причина:</span> ${escapeHtml(blocked.reason || "Не указана")}
                </div>
                <div style="margin: 8px 0 4px 0; font-size: 12px; color: #888;">👮 Заблокировал: ${escapeHtml(blocked.blockedBy || "Администратор")}</div>
                <div class="card-actions">
                    ${hasValidId
                        ? `<button class="btn-unblock" onclick="unblockUser('${blocked.telegramId}', '${escapeHtml(blocked.userName || "Пользователь").replace(/'/g, "\\'")}')">🔓 Разблокировать</button>`
                        : `<button class="btn-unblock" style="background: #6c757d !important; cursor: not-allowed;" disabled>🔓 Разблокировать (нет ID)</button>`
                    }
                </div>
            `;
            list.appendChild(card);
        });
    } catch (e) {
        console.error("Load blocked users error:", e);
        list.innerHTML = "❌ Ошибка загрузки списка";
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
        showMessage('Ошибка', '❌ Не удалось определить ID пользователя.');
        return;
    }
    
    document.getElementById('blockUserId').value = String(userId).trim();
    document.getElementById('blockUserDisplayName').value = userName || "Пользователь";
    document.getElementById('blockUserName').innerText = 'Пользователь: ' + userName + ' (ID: ' + userId + ')';
    document.getElementById('blockReason').value = '';
    document.getElementById('blockModal').style.display = 'flex';
};

window.closeBlockModal = function() {
    document.getElementById('blockModal').style.display = 'none';
};

window.confirmBlock = async function() {
    const reason = document.getElementById('blockReason').value.trim();
    if (reason === "") {
        showMessage('Ошибка', 'Пожалуйста, укажите причину блокировки!');
        return;
    }
    
    const targetId = document.getElementById('blockUserId').value;
    const targetName = document.getElementById('blockUserDisplayName').value;
    
    if (!targetId || targetId === "" || targetId === "null") {
        showMessage('Ошибка', '❌ Не удалось определить пользователя для блокировки.');
        closeBlockModal();
        return;
    }
    
    closeBlockModal();
    
    try {
        const res = await apiRequest({
            action: 'block_user',
            adminId: user ? user.id : 0,
            targetId: targetId,
            userName: targetName,
            reason: reason,
            adminName: user?.first_name || user?.username || "Администратор"
        });
        
        if (res.status === 'success') {
            showMessage('✅ Заблокирован', 'Пользователь ' + targetName + ' заблокирован.');
            loadTickets();
            loadBlockedUsers();
        } else {
            throw new Error(res.error || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Block error:', error);
        showMessage('Ошибка', 'Не удалось заблокировать пользователя: ' + error.message);
    }
};

window.unblockUser = async function(userId, userName) {
    if (!userId || userId === "" || userId === "?" || userId === "null") {
        showMessage('Ошибка', '❌ Не удалось определить ID пользователя.');
        return;
    }
    
    if (confirm('Разблокировать пользователя ' + userName + '?')) {
        try {
            const res = await apiRequest({
                action: 'unblock_user',
                adminId: user ? user.id : 0,
                targetId: userId
            });
            
            if (res.status === 'success') {
                showMessage('✅ Разблокирован', 'Пользователь ' + userName + ' успешно разблокирован.');
                loadTickets();
                loadBlockedUsers();
            } else {
                throw new Error(res.error || 'Неизвестная ошибка');
            }
        } catch (error) {
            console.error('Unblock error:', error);
            showMessage('Ошибка', 'Не удалось разблокировать пользователя: ' + error.message);
        }
    }
};

async function loadUserTickets() {
    const list = document.getElementById('userTicketsList');
    if (!list) return;
    
    list.innerHTML = "<p style='font-size: 13px;'>🔄 Загрузка ваших заявок...</p>";
    
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
            const statusClass = t.status.includes('Новая') ? 'status-new' : (t.status.includes('В работе') ? 'status-work' : 'status-done');
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600;">№${t.id} — Каб. ${t.room}</span>
                    <span class="status-badge ${statusClass}">${t.status}</span>
                </div>
                <div style="font-size: 13px; margin-top: 8px; opacity: 0.8;">${escapeHtml(t.problem)}</div>
            `;
            list.appendChild(item);
        });
    } catch (e) {
        console.error("Load user tickets error:", e);
        list.innerHTML = "❌ Ошибка загрузки заявок";
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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

window.addEventListener('load', () => {
    const ticketForm = document.getElementById('ticketForm');
    const fileInput = document.getElementById('photo');
    const fileNameDisplay = document.getElementById('fileName');
    
    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                fileNameDisplay.innerText = "✅ " + this.files[0].name;
            } else {
                fileNameDisplay.innerText = "📸 Прикрепить фото";
            }
        });
    }
    
    if (ticketForm) {
        ticketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const room = document.getElementById('room').value.trim();
            const problem = document.getElementById('problem').value.trim();
            const photoFile = fileInput ? fileInput.files[0] : null;
            
            if (!room) {
                showMessage('Ошибка', 'Введите номер кабинета');
                return;
            }
            if (!problem) {
                showMessage('Ошибка', 'Опишите проблему');
                return;
            }
            
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;
            btn.innerText = "🤖 ИИ анализирует...";
            
            try {
                let photoBase64 = "";
                if (photoFile) {
                    photoBase64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(photoFile);
                    });
                }
                
                const result = await apiRequest({
                    action: "create_ticket",
                    user: user?.username ? `@${user.username}` : (user?.first_name || "Аноним"),
                    telegramId: user ? user.id : 0,
                    room: room,
                    problem: problem,
                    photo: photoBase64
                });
                
                if (result.status === 'success') {
                    showMessage('✅ Отправлено!', 'Заявка создана. ИИ определил категорию и приоритет.');
                    ticketForm.reset();
                    if (fileNameDisplay) fileNameDisplay.innerText = "📸 Прикрепить фото";
                    loadUserTickets();
                } else if (result.error) {
                    showMessage('⚠️ Ошибка', result.error);
                } else {
                    throw new Error('Неизвестная ошибка');
                }
            } catch (error) {
                console.error("Submit error:", error);
                showMessage('❌ Ошибка', 'Не удалось отправить заявку. Попробуйте позже.');
            } finally {
                btn.disabled = false;
                btn.innerText = "Отправить";
            }
        });
    }
    
    checkRole();
});
