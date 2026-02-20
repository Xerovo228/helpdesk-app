let tg = window.Telegram.WebApp;
tg.expand();

// 🔥 ТВОЯ ССЫЛКА НА ГУГЛ СКРИПТ (СКОПИРУЙ ЕЕ ИЗ СТАРОГО SCRIPT.JS)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztD215U09edQ837xmYPzcCWxQTz7e7K2FIgs97e7vNbNDiTowqbzYrs9soVOWB5ApIlw/exec";

const userInfoEl = document.getElementById('userInfo');
let user = tg.initDataUnsafe?.user;

if (user) {
    userInfoEl.innerText = `👤 ${user.first_name} ${user.last_name || ''}`;
} else {
    userInfoEl.innerText = "🌐 Режим браузера";
}

// Показываем имя выбранного файла
const fileInput = document.getElementById('photo');
const fileNameDisplay = document.getElementById('fileName');

fileInput.addEventListener('change', function() {
    if (this.files && this.files.length > 0) {
        fileNameDisplay.innerText = "✅ Выбрано: " + this.files[0].name;
        document.querySelector('.file-upload-label').style.backgroundColor = "rgba(46, 204, 113, 0.1)";
        document.querySelector('.file-upload-label').style.borderColor = "#2ecc71";
        document.querySelector('.file-upload-label').style.color = "#27ae60";
    }
});

document.getElementById('ticketForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMessage');
    const room = document.getElementById('room').value;
    const problem = document.getElementById('problem').value;

    btn.disabled = true;
    btn.innerText = "⏳ Отправка данных...";
    statusMsg.innerText = "";

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
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                statusMsg.style.color = "#2ecc71";
                statusMsg.innerText = "🎉 Заявка успешно отправлена!";
                btn.innerText = "Отправлено";
                tg.MainButton.text = "Закрыть окно";
                tg.MainButton.show();
                tg.MainButton.onClick(() => tg.close());
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            statusMsg.style.color = "#e74c3c";
            statusMsg.innerText = "❌ Ошибка: " + error.message;
            btn.disabled = false;
            btn.innerText = "Попробовать снова";
        }
    }

    if (fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function() {
            const base64Data = reader.result.split(',')[1]; 
            sendData(base64Data);
        };
        reader.readAsDataURL(fileInput.files[0]);
    }
});
