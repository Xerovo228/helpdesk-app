let tg = window.Telegram.WebApp;
tg.expand();

// Твоя ссылка на Google Apps Script
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztD215U09edQ837xmYPzcCWxQTz7e7K2FIgs97e7vNbNDiTowqbzYrs9soVOWB5ApIlw/exec"; 

let currentRole = 'student';
let user = tg.initDataUnsafe?.user;

// --- 1. ПРОВЕРКА РОЛИ ПРИ ЗАПУСКЕ ---
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
        console.error("Ошибка проверки роли:", e);
        showView('student'); 
    }
}

// --- 2. ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ ---
function showView(view) {
    currentRole = view;
    const statusMsg = document.getElementById('statusMessage');
    if (statusMsg) statusMsg.innerText = ""; 

    if (view === 'admin') {
        document.getElementById('studentView').style.display = 'none';
        document.getElementById('adminView').style.display = 'block';
        loadTickets();
    } else {
        document.getElementById('studentView').style.display = 'block';
        document.getElementById('adminView').style.display = 'none';
    }
}

// Глобальная функция для кнопки переключения
window.toggleRole = function() {
    showView(currentRole === 'admin' ? 'student' : 'admin');
}

// --- 3. ЛОГИКА АДМИНА: ЗАГРУЗКА И ЗАКРЫТИЕ ---
async function loadTickets() {
    const list = document.getElementById('ticketsList');
    list.innerHTML = "<p style='text-align:center;'>🔄 Обновление списка...</p>";
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "get_tickets" })
        });
        const res = await response.json();
        
        list.innerHTML = "";
        if (!res.tickets || res.tickets.length === 0) {
            list.innerHTML = "<p style='text-align:center; padding: 20px;'>🎉 Активных заявок нет!</p>";
            return;
        }

        res.tickets.forEach(t => {
            const card = document.createElement('div');
            card.className = 'ticket-card';
            card.innerHTML = `
                <div><b>ID:</b> ${t.id} | 🚪 <b>Каб:</b> ${t.room}</div>
                <div style="margin: 8px 0; font-size: 15px;">${t.problem}</div>
                <div style="font-size:11px; color:gray; margin-bottom: 10px;">От: ${t.user}</div>
                <div class="card-actions">
                    <a href="${t.photoUrl}" target="_blank" class="btn-view">👀 Фото</a>
                    <button class="btn-done" onclick="closeTicket(${t.row}, this)">✅ Готово</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (e) {
        list.innerHTML = "<p style='color:red; text-align:center;'>❌ Ошибка загрузки данных</p>";
    }
}

window.closeTicket = async function(row, btn) {
    if (!confirm("Заявка выполнена?")) return;
    btn.disabled = true;
    btn.innerText = "⏳";
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: "update_status", row: row, newStatus: "🟢 Готово" })
        });
        loadTickets(); 
    } catch (e) {
        alert("Ошибка сети");
        btn.disabled = false;
    }
}

// --- 4. ЛОГИКА СТУДЕНТА: ОТПРАВКА ФОРМЫ ---
const fileInput = document.getElementById('photo');
const fileNameDisplay = document.getElementById('fileName');

if (fileInput) {
    fileInput.addEventListener('change', function() {
        if (this.files && this.files.length > 0) {
            fileNameDisplay.innerText = "✅ Фото: " + this.files[0].name;
        }
    });
}

const ticketForm = document.getElementById('ticketForm');
if (ticketForm) {
    ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitBtn');
        const statusMsg = document.getElementById('statusMessage');
        const room = document.getElementById('room').value;
        const problem = document.getElementById('problem').value;

        if (!fileInput.files.length) {
            alert("Пожалуйста, прикрепите фото!");
            return;
        }

        btn.disabled = true;
        btn.innerText = "🚀 Отправка...";

        const reader = new FileReader();
        reader.onload = async function() {
            const base64Data = reader.result.split(',')[1];
            const payload = {
                action: "create_ticket",
                user: user ? `${user.first_name} ${user.last_name || ''}` : "Аноним",
                telegramId: user ? user.id : 0,
                room: room,
                problem: problem,
                photo: base64Data
            };

            try {
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (result.status === 'success') {
                    statusMsg.style.color = "#2ecc71";
                    statusMsg.innerText = "✅ Заявка отправлена!";
                    ticketForm.reset();
                    fileNameDisplay.innerText = "📸 Прикрепить фото";
                    setTimeout(() => { tg.close(); }, 2000);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                statusMsg.style.color = "#e74c3c";
                statusMsg.innerText = "❌ Ошибка отправки!";
                btn.disabled = false;
                btn.innerText = "Попробовать снова";
            }
        };
        reader.readAsDataURL(fileInput.files[0]);
    });
}

// Запуск приложения
checkRole();
