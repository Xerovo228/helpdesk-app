let tg = window.Telegram.WebApp;
tg.expand();

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztD215U09edQ837xmYPzcCWxQTz7e7K2FIgs97e7vNbNDiTowqbzYrs9soVOWB5ApIlw/exec"; 

let currentRole = 'student';
let user = tg.initDataUnsafe?.user;

// 1. ПРОВЕРКА РОЛИ ПРИ ЗАПУСКЕ
async function checkRole() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "check_role", telegramId: user ? user.id : 0 })
        });
        const res = await response.json();
        
        if (res.role === 'admin') {
            document.getElementById('roleSwitcher').style.display = 'block';
            showView('admin');
        } else {
            showView('student');
        }
    } catch (e) {
        showView('student'); // По умолчанию студент
    }
}

// 2. ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
function showView(view) {
    currentRole = view;
    if (view === 'admin') {
        document.getElementById('studentView').style.display = 'none';
        document.getElementById('adminView').style.display = 'block';
        loadTickets();
    } else {
        document.getElementById('studentView').style.display = 'block';
        document.getElementById('adminView').style.display = 'none';
    }
}

function toggleRole() {
    showView(currentRole === 'admin' ? 'student' : 'admin');
}

// 3. ЗАГРУЗКА ЗАЯВОК ДЛЯ АДМИНА
async function loadTickets() {
    const list = document.getElementById('ticketsList');
    list.innerHTML = "<p style='text-align:center;'>Обновление списка...</p>";
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "get_tickets" })
        });
        const res = await response.json();
        
        list.innerHTML = "";
        if (res.tickets.length === 0) {
            list.innerHTML = "<p style='text-align:center;'>🎉 Активных заявок нет!</p>";
            return;
        }

        res.tickets.forEach(t => {
            const card = document.createElement('div');
            card.className = 'ticket-card';
            card.innerHTML = `
                <div><b>ID:</b> ${t.id} | 🚪 <b>Каб:</b> ${t.room}</div>
                <div style="margin: 5px 0;">${t.problem}</div>
                <div style="font-size:11px; color:gray;">От: ${t.user}</div>
                <div class="card-actions">
                    <a href="${t.photoUrl}" target="_blank" class="btn-view">👀 Фото</a>
                    <button class="btn-done" onclick="closeTicket(${t.row}, this)">✅ Готово</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (e) {
        list.innerHTML = "<p style='color:red;'>Ошибка загрузки</p>";
    }
}

// 4. ЗАКРЫТИЕ ЗАЯВКИ
async function closeTicket(row, btn) {
    btn.disabled = true;
    btn.innerText = "...";
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "update_status", row: row, newStatus: "🟢 Готово" })
        });
        loadTickets(); // Обновляем список
    } catch (e) {
        alert("Ошибка при обновлении статуса");
        btn.disabled = false;
    }
}

// Остальная логика (отправка формы студентом) остается как была...
// [Скопируй сюда обработчик 'submit' и выбор файла из предыдущего script.js]

checkRole();
