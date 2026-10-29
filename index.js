const { Client, LocalAuth, Buttons } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz-DQlqj1OsjXWQNy6a2VMtNJ_4BQDJSfVOcfC1iN3nLeB3cNCQI_e9kQGqKcAhc-bn/exec";
const WHATSAPP_GROUP_NAME = "Робоча Група Їстик"; 

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('QR LINK: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qr));
});

client.on('ready', () => {
    console.log('WhatsApp Бот успешно запущен на Render!');
});

app.post('/api/new-lead', async (req, res) => {
    const data = req.body;
    res.status(200).json({ success: true });

    try {
        const chats = await client.getChats();
        const targetGroup = chats.find(chat => chat.isGroup && chat.name === WHATSAPP_GROUP_NAME);

        if (!targetGroup) return console.error(`Группа "${WHATSAPP_GROUP_NAME}" не найдена!`);

        // Додано поле URL джерела у повідомлення WhatsApp
        const messageText = 
`🔔 *Нова заявка партнерства на сайті Їстик!*

👤 *Ім'я:* ${data.name || 'Не вказано'}
📞 *Телефон:* ${data.phone || 'Не вказано'}
🏢 *Тип бізнесу:* ${data.business_type || 'Не вказано'}
🏷️ *Назва бізнесу:* ${data.business_name || 'Не вказано'}
💬 *Повідомлення:* ${data.message || 'Порожнє'}
🔗 *Джерело (URL):* ${data.url || 'Не вказано'}

📌 *Статус:* 🆕 Нова`;

        const buttons = new Buttons(
            messageText,
            [
                { id: `s:${data.row}_${data.tg_message_id}:nc`, body: "📵 Немає зв'язку" },
                { id: `s:${data.row}_${data.tg_message_id}:ok`, body: '✅ Оброблено' },
                { id: `s:${data.row}_${data.tg_message_id}:wt`, body: '🤔 Клієнт вагається' }
            ],
            'Evelina'
        );

        await client.sendMessage(targetGroup.id._serialized, buttons);
    } catch (err) {
        console.error('Ошибка отправки в WhatsApp:', err);
    }
});

app.post('/api/update-whatsapp-status', async (req, res) => {
    res.status(200).json({ success: true });
    try {
        const chats = await client.getChats();
        const targetGroup = chats.find(chat => chat.isGroup && chat.name === WHATSAPP_GROUP_NAME);
        if (targetGroup) {
            await client.sendMessage(targetGroup.id._serialized, `ℹ️ Статус заявки №${req.body.row} было изменено через Telegram менеджером *${req.body.who}* на: *${req.body.status}*`);
        }
    } catch (err) {
        console.error('Не удалось отправить сервисный статус в WhatsApp:', err);
    }
});

client.on('message_create', async (msg) => {
    if (msg.type === 'buttons_response') {
        const [prefix, rawMeta, code] = msg.selectedButtonId.split(':');
        
        if (prefix === 's') {
            const [row, tgMessageId] = rawMeta.split('_');
            const contact = await msg.getContact();
            const who = contact.pushname || contact.name || "Менеджер WhatsApp";

            try {
                const response = await axios.post(GOOGLE_SCRIPT_URL, {
                    action: "update_status",
                    row: row,
                    tg_message_id: tgMessageId !== 'null' ? tgMessageId : null,
                    code: code,
                    who: who
                });

                if (response.data && response.data.status === 'success') {
                    await msg.reply(`Менеджер *${who}* изменил status заявки №${row} на: *${response.data.updatedStatus}*`);
                }
            } catch (err) {
                console.error('Ошибка обновления через Google Script:', err);
                await msg.reply('❌ Не удалось обновить общий статус.');
            }
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));

client.initialize();
