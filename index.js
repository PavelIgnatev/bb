import fs from "fs";
import path from "path";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const userFilePath = path.join(__dirname, "users.json");

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const secondMessage = `Приятно познакомиться, идем дальше!

В следующем видео мы расскажем, как мы привлекаем потенциальных клиентов с использованием технологии искусственного интеллекта.`;
const thirdMessage = `А вот и результат!

Переходим к финальному видео - применению AISender в проектах наших заказчиков`;
const finalMessage = `Благодарим вас за ознакомление с нашим продуктом.

Специалист AiSender в скором времени свяжется с вами для обсуждения того, как наше решение сможет помочь Вам в привлечении потенциальных клиентов.

Однако, если вы уже готовы, вы можете самостоятельно назначить встречу прямо сейчас, нажав на кнопку "ЗАПИСАТЬСЯ НА ВСТРЕЧУ".`;
const communicationZoomDateMessage = `
Пожалуйста, выберите ДЕНЬ для проведения встречи. (MSK, UTC+3)`;
const communicationZoomTimeMessage = `
Пожалуйста, выберите ВРЕМЯ для проведения встречи. (MSK, UTC+3)`;

const callManager = {
  text: "ЗАПИСАТЬСЯ НА ВСТРЕЧУ",
  callback_data: JSON.stringify({ status: "communicate_call" }, null, 2),
};

async function wrapPromise(promiseFn) {
  let i = 0;

  while (true) {
    try {
      console.log("Вызываю функцию", promiseFn.toString());
      return await promiseFn();
    } catch (e) {
      console.log(
        `Произошла ошибка в функции ${promiseFn.toString()}: ${
          e.message
        }; Итерация ${i}`
      );
      await new Promise((res) => setTimeout(res, 2500));
      i++;

      if (i > 10) {
        return await promiseFn();
      }
    }
  }
}

const generateDatePicker = () => {
  const currentDate = new Date();
  const daysInTwoWeeks = 9;
  const inlineKeyboard = [];
  let currentRow = [];

  for (let day = 0; day < daysInTwoWeeks; day++) {
    const date = new Date(currentDate);
    date.setDate(currentDate.getDate() + day);

    if (day === 0 && date.getHours() >= 15) {
      continue;
    }

    const dateButton = {
      text: formatDate(date),
      callback_data: JSON.stringify({
        date: formatDate(date),
        status: "communicate_call",
      }),
    };

    currentRow.push(dateButton);

    if (currentRow.length === 3 || day === daysInTwoWeeks - 1) {
      inlineKeyboard.push([...currentRow]);
      currentRow = [];
    }
  }

  return inlineKeyboard;
};

const generateTimeSubMenu = (date) => {
  const timeSubMenu = [];
  const currentDate = new Date();
  const currentHour = currentDate.getHours();

  for (let hour = 9; hour < 18; hour += 2) {
    const row = [];

    for (let i = 0; i < 2; i++) {
      const currentHourOfDay = hour + i;

      if (
        currentHourOfDay > currentHour + 4 ||
        date !== formatDate(currentDate)
      ) {
        const time = `${currentHourOfDay.toString().padStart(2, "0")}:00`;

        row.push({
          text: time,
          callback_data: JSON.stringify({
            date,
            time: `${currentHourOfDay.toString().padStart(2, "0")}:00`,
            status: "communicate_call",
          }),
        });
      }
    }

    if (row.length > 0) {
      timeSubMenu.push(row);
    }
  }

  if (timeSubMenu.length > 0) {
    timeSubMenu.push([
      {
        text: "Выбрать другой день",
        callback_data: JSON.stringify({
          status: "communicate_call",
        }),
      },
    ]);
  }

  return timeSubMenu;
};

const formatDate = (date) => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}.${month}`;
};

const inlineKeyboardStatus = (status, text) => [
  [
    {
      text: text || "Следующее видео",
      callback_data: JSON.stringify({ status }, null, 2),
    },
  ],
];

const clearKeyBoard = (chatId, messageId, addMarkup) =>
  wrapPromise(() =>
    bot.editMessageReplyMarkup(
      {
        inline_keyboard: addMarkup ?? [],
      },
      {
        chat_id: chatId,
        message_id: messageId,
      }
    )
  );

const editMessageText = (chatId, messageId, newText) =>
  wrapPromise(() =>
    bot.editMessageText(newText, {
      chat_id: chatId,
      message_id: messageId,
    })
  );

const toStatus = (chatId, messageId, status, first_name, last_name, username) =>
  wrapPromise(() =>
    bot.emit("callback_query", {
      message: {
        chat: { id: chatId, first_name, last_name, username },
        message_id: messageId,
      },
      data: JSON.stringify({ status }, null, 2),
    })
  );

const sendVideoToUser = async (chatId, filename, inlineKeyboard) => {
  try {
    const videoPath = path.join(__dirname, "videos", filename);
    const videoContent = await fs.promises.readFile(videoPath);

    const sentVideo = await wrapPromise(() =>
      bot.sendVideo(chatId, videoContent, {
        filename,
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      })
    );

    return sentVideo.message_id;
  } catch (error) {
    console.error("Ошибка отправки видео:", error.message);

    return null;
  }
};

const sendToChannel = async (messageText) => {
  try {
    const channelInfo = await bot.getChat("@autoaicheck"); 
    await wrapPromise(() =>
      bot.sendMessage(channelInfo.id, messageText, {
        parse_mode: "HTML",
      })
    );
  } catch (error) {
    console.error("Ошибка отправки сообщения в канал:", error.message);
  }
};

const readUsernamesFromFile = () => {
  try {
    const data = fs.readFileSync(userFilePath);
    return JSON.parse(data);
  } catch (error) {
    console.error("Ошибка чтения файла users.json:", error.message);
    return [];
  }
};

const writeUsernameToFile = (id, status, addedInfo={}) => {
  const users = readUsernamesFromFile();

  const existingUserIndex = users.findIndex((user) => user.id === id);

  if (existingUserIndex !== -1 && users[existingUserIndex]) {
    users[existingUserIndex].status = status;
    users[existingUserIndex].dateUpdated = new Date();
  } else {
    users.push({ id, status, dateCreated: new Date(), ...addedInfo});
  }

  try {
    fs.writeFileSync(userFilePath, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error("Ошибка записи в файл users.json:", error.message);
  }
};

const getCurrentStatus = (id) => {
  const users = readUsernamesFromFile();

  const existingUserIndex = users.findIndex((user) => user.id === id);

  if (existingUserIndex !== -1) {
    return users[existingUserIndex].status;
  }

  return null;
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id,
    userFirstName = msg.chat.first_name
	let bio
	try{
		const {bio: chatBio} = await bot.getChat(chatId)
		bio = chatBio;
	}catch(e){
		console.log(`Error: ${e.message}`)
	}


  try {
    const hiMessage = `Привет, ${userFirstName}!

Ранее с вами связался сотрудник компании AiSender, которого, на самом деле, не существует.

Это один из наших менеджеров, которого мы наделили возможностью общаться с использованием технологии искусственного интеллекта. Немного позднее мы подробно расскажем о том, как это работает.`;
    const hiRustamMessage = `А пока что я предлагаю познакомиться. На связи Рустам - один из основателей компании AiSender.
    
Приятного просмотра!`;
    const channelMessage = `🚀 ЗАПУСК ВОРОНКИ 🚀
  
ID: ${msg.chat.id}
Имя: ${msg.chat.first_name} ${msg.chat.last_name ? msg.chat.last_name : ""}${(bio) ? `\nОписание: ${bio}` : ''}
Ссылка: @${msg.chat.username}`;

    await wrapPromise(() => bot.sendMessage(chatId, hiMessage));
    await wrapPromise(() => bot.sendMessage(chatId, hiRustamMessage));

    const newMessageID = await sendVideoToUser(
      chatId,
      "one.mp4",
      inlineKeyboardStatus("second")
    );

    sendToChannel(channelMessage);
    writeUsernameToFile(msg.chat.id, "started", {firstName: msg.chat.first_name, lastName: msg.chat.last_name, userName: msg.chat.username, bio});

    setTimeout(() => {
      const status = getCurrentStatus(msg.chat.id);

      if (status && status === "started") {
        toStatus(
          chatId,
          newMessageID,
          "second",
          msg.chat.first_name,
          msg.chat.last_name,
          msg.chat.username
        );
      }
    }, 120000);
  } catch (error){
    console.error("Ошибка отправки /start:", error.message);
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const parsedCallbackData = JSON.parse(callbackQuery.data);
  const callbackStatus = parsedCallbackData.status;

  try {
    switch (callbackStatus) {
      case "second":
        await wrapPromise(() => bot.sendMessage(chatId, secondMessage));
        await clearKeyBoard(chatId, messageId);
        const newMessageID = await sendVideoToUser(
          chatId,
          "second.mp4",
          inlineKeyboardStatus("third")
        );
        writeUsernameToFile(callbackQuery.message.chat.id, "second_video");

        setTimeout(() => {
          const status = getCurrentStatus(callbackQuery.message.chat.id);

          if (status && status === "second_video") {
            toStatus(
              chatId,
              newMessageID,
              "third",
              callbackQuery.message.chat.first_name,
              callbackQuery.message.chat.last_name,
              callbackQuery.message.chat.username
            );
          }
        }, 150000);

        break;

      case "third":
        await wrapPromise(() => bot.sendMessage(chatId, thirdMessage));
        await clearKeyBoard(chatId, messageId);
        const newMessageThirdID = await sendVideoToUser(
          chatId,
          "third.mp4",
          inlineKeyboardStatus("final", "Дальше")
        );
        writeUsernameToFile(callbackQuery.message.chat.id, "third_video");

        setTimeout(() => {
          const status = getCurrentStatus(callbackQuery.message.chat.id);

          if (status && status === "third_video") {
            toStatus(
              chatId,
              newMessageThirdID,
              "final",
              callbackQuery.message.chat.first_name,
              callbackQuery.message.chat.last_name,
              callbackQuery.message.chat.username
            );
          }
        }, 20000);
        break;

      case "final":
        await wrapPromise(() =>
          bot.sendMessage(chatId, finalMessage, {
            reply_markup: {
              inline_keyboard: [[callManager]],
            },
          })
        );
        await clearKeyBoard(chatId, messageId);
        writeUsernameToFile(callbackQuery.message.chat.id, "finished");
        sendToChannel(`✅ ВОРОНКА ПРОЙДЕНА ✅

ID: ${callbackQuery.message.chat.id}
Имя: ${callbackQuery.message.chat.first_name} ${
          callbackQuery.message.chat.last_name
            ? callbackQuery.message.chat.last_name
            : ""
        }
Ссылка: @${callbackQuery.message.chat.username}
`);

        break;

      case "communicate_call":
        if (!parsedCallbackData.date) {
          await bot.sendMessage(chatId, communicationZoomDateMessage, {
            reply_markup: {
              inline_keyboard: generateDatePicker(),
            },
          });
        } else if (!parsedCallbackData.time) {
          await editMessageText(
            chatId,
            messageId,
            communicationZoomTimeMessage
          );
          await clearKeyBoard(
            chatId,
            messageId,
            generateTimeSubMenu(parsedCallbackData.date)
          );

          sendToChannel(`🗓️ ВЫБРАЛ ДЕНЬ ВСТРЕЧИ 🗓️

День: ${parsedCallbackData.date}
ID: ${callbackQuery.message.chat.id}
Имя: ${callbackQuery.message.chat.first_name} ${
            callbackQuery.message.chat.last_name
              ? callbackQuery.message.chat.last_name
              : ""
          }
Ссылка: @${callbackQuery.message.chat.username}`);
        } else {
          await clearKeyBoard(chatId, messageId);
          await editMessageText(
            chatId,
            messageId,
            `Спасибо, вы записаны на ${parsedCallbackData.date} в ${parsedCallbackData.time}.

В скором времени наш специалист свяжется с Вами для подтверждения встречи.`
          );
          writeUsernameToFile(
            callbackQuery.message.chat.id,
            "communicate_zoom"
          );
          sendToChannel(`☎️ ЗАПРОС НА ВСТРЕЧУ ☎️

Дата: ${parsedCallbackData.date}/${parsedCallbackData.time}
ID: ${callbackQuery.message.chat.id}
Имя: ${callbackQuery.message.chat.first_name} ${
            callbackQuery.message.chat.last_name
              ? callbackQuery.message.chat.last_name
              : ""
          }
Ссылка: @${callbackQuery.message.chat.username}`);
        }

        break;
    }
  } catch (error) {
    console.error("Ошибка отправки:", error.message);
  }
});

bot.on("text", (msg) => {
  if (msg.text !== "/start") {
    const chatId = msg.chat.id;

    bot.sendMessage(
      chatId,
      `Прощу прощения, но я не могу ответить на ваш запрос "${msg.text}". Смотрите видео, наш сотрудник скоро свяжется с вами!`
    );
  }
});