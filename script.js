// Инициализируем Телеграм
let tg = window.Telegram.WebApp;
tg.expand(); // Открываем на весь экран

// 🔥 ВСТАВЬ СЮДА СВОЙ URL ОТ GOOGLE APPS SCRIPT
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztD215U09edQ837xmYPzcCWxQTz7e7K2FIgs97e7vNbNDiTowqbzYrs9soVOWB5ApIlw/exec";

// Выводим имя пользователя
const userInfoEl = document.getElementById('userInfo');
let user = tg.initDataUnsafe?.user;

if (user) {
    userInfoEl.innerText = `Пользователь: ${user.first_name} ${user.last_name || ''}`;
} else {
    userInfoEl.innerText = "Режим отладки (вне Telegram)";
}

// Обработка отправки формы
document.getElementById('ticketForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Останавливаем стандартную перезагрузку страницы
    
    const btn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMessage');
    
    const room = document.getElementById('room').value;
    const problem = document.getElementById('problem').value;
    const fileInput = document.getElementById('photo');

    btn.disabled = true;
    btn.innerText = "Отправка...";
    statusMsg.innerText = "";

    // Функция для отправки данных (вызывается после обработки фото)
    async function sendData(photoBase64) {
        const payload = {
            action: "create_ticket",
            user: user ? `${user.first_name} ${user.last_name || ''}` : "Аноним",
            telegramId: user ? user.id : 0,
            room: room,
            problem: problem,
            photo: photoBase64
        };

        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                // Google Apps Script требует plain/text для CORS
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                statusMsg.style.color = "green";
                statusMsg.innerText = "✅ Заявка успешно отправлена!";
                // Показываем кнопку закрытия от Телеграма
                tg.MainButton.text = "Закрыть";
                tg.MainButton.show();
                tg.MainButton.onClick(() => tg.close());
            } else {
                throw new Error(result.error || "Неизвестная ошибка сервера");
            }
        } catch (error) {
            statusMsg.style.color = "red";
            statusMsg.innerText = "❌ Ошибка: " + error.message;
            btn.disabled = false;
            btn.innerText = "Отправить заявку";
        }
    }

    // Читаем файл фото
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function() {
            // Отрезаем начало "data:image/jpeg;base64," чтобы передать чистый код
            const base64Data = reader.result.split(',')[1]; 
            sendData(base64Data);
        };
        reader.readAsDataURL(file);
    }
});