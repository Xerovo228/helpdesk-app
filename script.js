let tg = window.Telegram.WebApp;
tg.expand();

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztD215U09edQ837xmYPzcCWxQTz7e7K2FIgs97e7vNbNDiTowqbzYrs9soVOWB5ApIlw/exec"; 

let currentRole = 'student';
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
    } catch (e) { showView('student'); }
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

// ЗАГРУЗКА ЗАЯВОК ДЛЯ АДМИНА
async function loadTickets() {
    const list = document.getElementById('ticketsList');
    const stats = document.getElementById('adminStats');
    list.innerHTML = "<p style='text-align:center;'>🔄 Обновление...</p>";
    
    try {
        const res = await apiRequest({ action: "get_tickets" });
        list.innerHTML = "";
        stats.innerHTML = `📝 Всего: <b>${res.totalCount || 0}</b> | ✅ Готово: <b>${res.completedCount || 0}</b>`;

        if (!res.tickets || res.tickets.length === 0) {
            list.innerHTML = "<p style='text-align:center; padding: 20px;'>🎉 Нет активных заявок</p>";
            return;
        }

        res.tickets.forEach(t => {
            const card = document.createElement('div');
            card.className = 'ticket-card';
            const isProcessing = t.status === "🔧 В работе";
            
            card.innerHTML = `
                <div><b>ID: ${t.id}</b> | 🚪 Каб: ${t.room}</div>
                <div style="margin: 8px 0; font-size: 15px;">${t.problem}</div>
                <div class="card-actions">
                    <a href="${t.photoUrl}" target="_blank" class="btn-view">Фото</a>
                    ${isProcessing 
                        ? `<button class="btn-done" onclick="closeTicket(${t.row}, this)">Готово</button>` 
                        : `<button class="btn-take" onclick="takeTicket(${t.row}, this)">В работу</button>`
                    }
                </div>
            `;
            list.appendChild(card);
        });
    } catch (e) { stats.innerHTML = "Ошибка связи"; }
}

// ЗАГРУЗКА ЗАЯВОК ДЛЯ СТУДЕНТА
async function loadUserTickets() {
    const list = document.getElementById('userTicketsList');
    try {
        const res = await apiRequest({ action: "get_user_tickets", telegramId: user ? user.id : 0 });
        if (!res.tickets || res.tickets.length === 0) {
            list.innerHTML = "<p style='font-size: 13px; color: var(--tg-theme-hint-color);'>Активных заявок нет</p>";
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
    } catch (e) { list.innerHTML = "Ошибка загрузки ваших данных"; }
}

window.takeTicket = async function(row, btn) {
    btn.disabled = true;
    try {
        await apiRequest({ action: "update_status", row: row, newStatus: "🔧 В работе" });
        loadTickets();
    } catch (e) { btn.disabled = false; }
};

window.closeTicket = async function(row, btn) {
    btn.disabled = true;
    try {
        await apiRequest({ action: "update_status", row: row, newStatus: "🟢 Готово" });
        loadTickets();
    } catch (e) { btn.disabled = false; }
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
            btn.innerText = "🚀 Отправка...";

            const reader = new FileReader();
            reader.onload = async function() {
                const base64Data = reader.result.split(',')[1];
                try {
                    await apiRequest({
                        action: "create_ticket",
                        user: user?.username ? `@${user.username}` : (user?.first_name || "Аноним"),
                        telegramId: user ? user.id : 0,
                        room: document.getElementById('room').value,
                        problem: document.getElementById('problem').value,
                        photo: base64Data
                    });
                    tg.close();
                } catch (error) {
                    btn.disabled = false;
                    btn.innerText = "Ошибка";
                }
            };
            reader.readAsDataURL(fileInput.files[0]);
        });
    }
});

checkRole();
