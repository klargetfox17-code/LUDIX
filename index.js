const { Telegraf, Markup } = require('telegraf')
const Database = require('better-sqlite3')
require('dotenv').config()

const token = process.env.BOT_TOKEN || '8721680626:AAFuGPHaUhZfXQeRQsEQXcNvYG5uDzWIG5s'
const bot = new Telegraf(token)
const db = new Database('game.db')

// ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ
db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  telegramId TEXT PRIMARY KEY,
  username TEXT,
  balance INTEGER DEFAULT 1000,
  income INTEGER DEFAULT 20,
  lastDaily INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  winstreak INTEGER DEFAULT 0,
  totalWon INTEGER DEFAULT 0,
  totalLost INTEGER DEFAULT 0,
  casesOpened INTEGER DEFAULT 0,
  debt INTEGER DEFAULT 0,
  debtTimer INTEGER DEFAULT 0,
  blacklist INTEGER DEFAULT 0,
  credits INTEGER DEFAULT 0,
  allTimeProfit INTEGER DEFAULT 0
)
`).run()

// Авто-добавление колонок для старых пользователей (если база данных уже создана)
const columns = [
  'xp DEFAULT 0', 'level DEFAULT 1', 'winstreak DEFAULT 0', 
  'totalWon DEFAULT 0', 'totalLost DEFAULT 0', 'casesOpened DEFAULT 0', 
  'debt DEFAULT 0', 'debtTimer DEFAULT 0', 'blacklist DEFAULT 0', 
  'credits DEFAULT 0', 'allTimeProfit DEFAULT 0',
  'lastWork DEFAULT 0' // <-- ОБЯЗАТЕЛЬНО ДОПИШИТЕ СЮДА ЧЕРЕЗ ЗАПЯТУЮ!
]
for (const col of columns) {
  try { db.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run() } catch (e) {}
}

// ГЛОБАЛЬНЫЕ ФУНКЦИИ ИГРЫ
// СМАРТ-ПОЛУЧЕНИЕ ИГРОКА (Авто-старт при краше сервера)
function getUser(id, ctx = null) {
  let user = db.prepare('SELECT * FROM users WHERE telegramId = ?').get(id)
  
  // Если сервера перезагрузился, а игрок нажал кнопку — создаем его в базе на лету!
  if (!user && ctx) {
    const username = ctx.from.username || 'player'
    createUser(id, username)
    user = db.prepare('SELECT * FROM users WHERE telegramId = ?').get(id)
    
    ctx.reply(
      '🔄 *LUDIX СЕРВЕР ОБНОВЛЕН!*\nВаш профиль успешно восстановлен. Главное меню активировано внизу.',
      Markup.keyboard([
        ['💰 Профиль', '🎰 Казино'],
        ['🛒 Магазин', '🎁 Daily'],
        ['📊 Стата', '🏆 Топ'],
        ['📦 Кейсы', '🏦 Кредит'],
        ['💼 Работа']
      ]).resize(),
      { parse_mode: 'Markdown' }
    )
  }
  return user
}


function createUser(id, username) {
  db.prepare(
    'INSERT OR IGNORE INTO users (telegramId, username) VALUES (?, ?)'
  ).run(id, username)
}

function checkLevelUp(id) {
  const user = getUser(id)
  if (!user) return false
  const needXP = user.level * 100

  if (user.xp >= needXP) {
    db.prepare(
      'UPDATE users SET level = level + 1, xp = 0, balance = balance + 10000 WHERE telegramId = ?'
    ).run(id)
    return true
  }
  return false
}

// ГЛАВНОЕ МЕНЮ (СТАРТ)
bot.start((ctx) => {
  const id = String(ctx.from.id)
  const username = ctx.from.username || 'player'

  createUser(id, username)

  ctx.reply(
    '💸 ДОБРО ПОЖАЛОВАТЬ В ИГРУ LUDIX',
       Markup.keyboard([
      ['💰 Профиль', '🎰 Казино'],
      ['🛒 Магазин', '🎁 Daily'],
      ['📊 Стата', '🏆 Топ'],
      ['📦 Кейсы', '🏦 Кредит'],
      ['💼 Работа'] // <-- ВЫВЕЛИ РАБОТУ ОТДЕЛЬНОЙ СТРОКОЙ НА ГЛАВНЫЙ ЭКРАН
    ]).resize()

  )
})

// ОБРАБОТЧИК КНОПКИ НАЗАД В ГЛАВНОЕ МЕНЮ
bot.hears('↩️ Назад в меню', (ctx) => {
  ctx.reply(
    '↩️ Вы вернулись в главное меню LUDIX',
    Markup.keyboard([
      ['💰 Профиль', '🎰 Казино'],
      ['🛒 Магазин', '🎁 Daily'],
      ['📊 Стата', '🏆 Топ'],
      ['📦 Кейсы', '🏦 Кредит'],
      ['💼 Работа']
    ]).resize()
  )
})


// ОБРАБОТКА ПОСТОЯННЫХ КНОПОК (МЕНЮ)

// 1. ПРОФИЛЬ
bot.hears('💰 Профиль', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')

  ctx.reply(`
👤 *ПРОФИЛЬ ИГРОКА LUDIX* @${user.username}
━━━━━━━━━━━━━━━━━━━━
💵 Баланс: *${user.balance}$*
📈 Доход: *${user.income}$/мин*

🏆 Уровень: *${user.level}*
⭐ Опыт (XP): *${user.xp} / ${user.level * 100}*
🔥 Винстрик: *${user.winstreak}*
━━━━━━━━━━━━━━━━━━━━
  `, { parse_mode: 'Markdown' })
})


// 2. КАЗИНО (Инлайн кнопки для под-меню игр)
// 2. КАЗИНО (ПЕРЕКЛЮЧЕНИЕ НА МЕНЮ ИГР ВНИЗУ ЭКРАНА)
bot.hears('🎰 Казино', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')

  ctx.reply(`
🎰 *ДОБРО ПОЖАЛОВАТЬ В КАЗИНО LUDIX* 🎰
━━━━━━━━━━━━━━━━━━━━
💵 Ваш баланс: *${user.balance}$*

Вы перешли в меню выбора игр. Кнопки управления теперь внизу экрана!
  `, Markup.keyboard([
    ['🪙 Монетка (x2)', '🎲 Слоты (до x15)'],
    ['↩️ Назад в меню']
  ]).resize())
})

// ВЫБОР СТАВОК ДЛЯ МОНЕТКИ (COINFLIP)
bot.hears('🪙 Монетка (x2)', (ctx) => {
  const user = getUser(String(ctx.from.id), ctx)
  ctx.reply(`
🪙 *РЕЖИМ: COINFLIP (МОНЕТКА)*
━━━━━━━━━━━━━━━━━━━━
💵 Баланс: *${user.balance}$*
🔥 Винстрик: *${user.winstreak}*
Шанс победы: *47.5%* (House Edge: 5.25%)

_Выберите размер вашей ставки кнопками ниже:_
  `, Markup.keyboard([
    ['💵 Ставка: 100$', '💵 Ставка: 500$'],
    ['💵 Ставка: 1000$', '💵 Ставка: 5000$'],
    ['🔥 Рискнуть Вобанк (All-In)'],
    ['🎰 Вернуться в Казино', '↩️ Назад в меню']
  ]).resize())
})
// АНИМИРОВАННАЯ ИГРА В СЛОТЫ ЧЕРЕЗ ТЕКСТОВУЮ КНОПКУ
// МЕНЮ СЛОТОВ
// ULTRA ANIMATED SLOTS LUDIX
bot.hears('🎲 Слоты (до x15)', async (ctx) => {
  const user = getUser(String(ctx.from.id))

  if (!user || user.balance < 1000) {
    return ctx.reply('💀 Недостаточно денег для прокрута!')
  }

  // Сразу списываем ставку
  db.prepare(`
    UPDATE users
    SET balance = balance - 1000
    WHERE telegramId = ?
  `).run(String(ctx.from.id))

  const symbols = ['🍒', '💎', '🔥', '🍋', '7️⃣', '⚡']

  // Отправляем старт
  const msg = await ctx.reply(`
🎰 LUDIX SLOTS

[ ❔ | ❔ | ❔ ]

🌀 Запуск барабанов...
`)

  // КАДР 1
  setTimeout(async () => {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
`
🎰 LUDIX SLOTS

[ 🍒 | 💎 | 🔥 ]

⚡ Барабаны крутятся...
`
    ).catch(() => {})
  }, 300)

  // КАДР 2
  setTimeout(async () => {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
`
🎰 LUDIX SLOTS

[ 🍋 | 🍒 | ⚡ ]

🔥 Скорость растет...
`
    ).catch(() => {})
  }, 600)

  // КАДР 3
  setTimeout(async () => {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
`
🎰 LUDIX SLOTS

[ 💎 | 7️⃣ | 🍒 ]

💨 Почти...
`
    ).catch(() => {})
  }, 900)

  // ФИНАЛ
  setTimeout(async () => {
    const a = symbols[Math.floor(Math.random() * symbols.length)]
    const b = symbols[Math.floor(Math.random() * symbols.length)]
    const c = symbols[Math.floor(Math.random() * symbols.length)]

    const result = `[ ${a} | ${b} | ${c} ]`

    // JACKPOT
    if (a === b && b === c) {

      const reward = 15000

      db.prepare(`
        UPDATE users
        SET balance = balance + ?,
            xp = xp + 40,
            winstreak = winstreak + 1,
            totalWon = totalWon + ?
        WHERE telegramId = ?
      `).run(reward, reward, String(ctx.from.id))

      const updatedUser = getUser(String(ctx.from.id))

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msg.message_id,
        null,
`
🎰 LUDIX SLOTS

${result}

🚨 JACKPOT x15
💰 Вы выиграли: +${reward}$

💵 Баланс: ${updatedUser.balance}$
🔥 Винстрик: ${updatedUser.winstreak}
`
      ).catch(() => {})

    } else {

      db.prepare(`
        UPDATE users
        SET xp = xp + 5,
            winstreak = 0,
            totalLost = totalLost + 1000
        WHERE telegramId = ?
      `).run(String(ctx.from.id))

      const updatedUser = getUser(String(ctx.from.id))

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msg.message_id,
        null,
`
🎰 LUDIX SLOTS

${result}

💀 ПРОИГРЫШ
-1000$

💵 Баланс: ${updatedUser.balance}$
`
      ).catch(() => {})
    }

  }, 1600)
})
// СИСТЕМНЫЙ ДВИЖОК МОНЕТКИ (ОБРАБОТКА И АНИМАЦИЯ СТАВОК)
// ====================================================================
// ИГРОВОЙ ДВИЖОК СЛОТОВ LUDIX И СЛУШАТЕЛИ СТАВОК
// ====================================================================

// СИСТЕМНЫЙ ДВИЖОК МОНЕТКИ (ОБРАБОТКА И АНИМАЦИЯ СТАВОК)
async function runCoinflipMenu(ctx, betAmount) {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')
  
  const bet = betAmount === 'allin' ? user.balance : betAmount

  if (bet < 10) return ctx.reply('❌ Минимальная ставка — 10$')
  if (user.balance < bet || user.balance <= 0) {
    return ctx.reply(`💀 Недостаточно денег! Ваш баланс: ${user.balance}$`)
  }

  const losePhrases = [
    'Казино LUDIX благодарит тебя за пожертвование.',
    'Твой винстрик с грохотом обнулился, лудоман.',
    'Не угадал. Монетка сегодня безжалостна.',
    'Минус кэш. Но в следующий раз точно повезет!'
  ]

  const message = await ctx.reply('🪙 *Монетка подброшена...* \n🌀 _Крутится-вертится в воздухе..._', { parse_mode: 'Markdown' })

  setTimeout(async () => {
    const win = Math.random() < 0.475 // 47.5% шанс на победу

    if (win) {
      db.prepare(`
        UPDATE users SET balance = balance + ?, xp = xp + 15, winstreak = winstreak + 1, totalWon = totalWon + ? WHERE telegramId = ?
      `).run(bet, bet, String(ctx.from.id))
      checkLevelUp(String(ctx.from.id))
      const updatedUser = getUser(String(ctx.from.id))

      await ctx.telegram.editMessageText(ctx.chat.id, message.message_id, null, `
🪙 *РЕЗУЛЬТАТ: ОРЕЛ!*
━━━━━━━━━━━━━━━━━━━━
🤑 Ты выиграл: *+${bet}$*
💵 Твой баланс: *${updatedUser.balance}$*
🔥 Текущий винстрик: *${updatedUser.winstreak}*
━━━━━━━━━━━━━━━━━━━━
      `, { parse_mode: 'Markdown' })
    } else {
      db.prepare(`
        UPDATE users SET balance = balance - ?, xp = xp + 5, winstreak = 0, totalLost = totalLost + ? WHERE telegramId = ?
      `).run(bet, bet, String(ctx.from.id))
      const updatedUser = getUser(String(ctx.from.id))
      const randText = losePhrases[Math.floor(Math.random() * losePhrases.length)]

      await ctx.telegram.editMessageText(ctx.chat.id, message.message_id, null, `
🪙 *РЕЗУЛЬТАТ: РЕШКА!*
━━━━━━━━━━━━━━━━━━━━
📉 Ты проиграл: *-${bet}$*
💵 Твой баланс: *${updatedUser.balance}$*
❌ _${randText}_
━━━━━━━━━━━━━━━━━━━━
      `, { parse_mode: 'Markdown' })
    }
  }, 1200)
}

// СЛУШАТЕЛИ КНОПОК СТАВОК ДЛЯ МОНЕТКИ
// ====================================================================
// АКТИВАТОРЫ КНОПОК СТАВОК ДЛЯ ОБЕИХ ИГР
// ====================================================================

// СЛУШАТЕЛИ ДЛЯ МОНЕТКИ (COINFLIP) — ИСПОЛЬЗУЮТ МЕШКИ 💵
bot.hears('💵 Ставка: 100$', (ctx) => runCoinflipMenu(ctx, 100))
bot.hears('💵 Ставка: 500$', (ctx) => runCoinflipMenu(ctx, 500))
bot.hears('💵 Ставка: 1000$', (ctx) => runCoinflipMenu(ctx, 1000))
bot.hears('💵 Ставка: 5000$', (ctx) => runCoinflipMenu(ctx, 5000))
bot.hears('🔥 Рискнуть Вобанк (All-In)', (ctx) => runCoinflipMenu(ctx, 'allin'))

// СЛУШАТЕЛИ ДЛЯ СЛОТОВ (SLOTS) — ИСПОЛЬЗУЮТ КУБИКИ 🎲
bot.hears('🎲 Ставка: 100$', (ctx) => runSlotsMenu(ctx, 100))
bot.hears('🎲 Ставка: 500$', (ctx) => runSlotsMenu(ctx, 500))
bot.hears('🎲 Ставка: 1000$', (ctx) => runSlotsMenu(ctx, 1000))
bot.hears('🎲 Ставка: 5000$', (ctx) => runSlotsMenu(ctx, 5000))
bot.hears('🔥 Крутануть Вобанк (All-In)', (ctx) => runSlotsMenu(ctx, 'allin'))





// 3. ТОП
// 3. ТОП-10 ИГРОКОВ LUDIX
bot.hears('🏆 Топ', (ctx) => {
  const users = db.prepare('SELECT * FROM users ORDER BY balance DESC LIMIT 10').all()
  let text = '🏆 *ТОП-10 БОГАТЕЕВ LUDIX*\n━━━━━━━━━━━━━━━━━━━━\n\n'
  
  users.forEach((user, index) => {
    let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹'
    text += `${medal} ${index + 1}. @${user.username} — *${user.balance}$*\n`
  })
  text += '\n━━━━━━━━━━━━━━━━━━━━'

  ctx.reply(text, { parse_mode: 'Markdown' })
})

// КРЕДИТ

// 4. КРЕДИТНАЯ СИСТЕМА И РАБОТА LUDIX
// ====================================================================
// РАЗДЕЛ: КРЕДИТНАЯ СИСТЕМА LUDIX
// ====================================================================

// МЕНЮ ВЫБОРА КРЕДИТА (Reply-кнопки)
bot.hears('🏦 Кредит', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')

  if (user.blacklist === 1) {
    return ctx.reply('❌ *БАНК LUDIX:* Вы находитесь в чёрном списке за неуплату кредита! Доступ заблокирован.', { parse_mode: 'Markdown' })
  }

  ctx.reply(`
🏦 *БАНКОВСКИЙ ОТДЕЛ LUDIX*
━━━━━━━━━━━━━━━━━━━━
💵 Ваш баланс: *${user.balance}$*
🏦 Текущий долг: *${user.debt || 0}$*
━━━━━━━━━━━━━━━━━━━━
💰 Доступный лимит займа (Зависит от уровня): *${user.level * 5000}$*
📈 Процентная ставка банка: *20%*
⏳ Срок на погашение: *10 минут*

_Используйте кнопки внизу экрана для управления займом:_
  `, Markup.keyboard([
    ['🏦 Взять Кредит', '💵 Погасить Кредит'],
    ['↩️ Назад в меню']
  ]).resize())
})

// ЛОГИКА ВЫДАЧИ КРЕДИТА
bot.hears('🏦 Взять Кредит', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')

  if (user.blacklist === 1) {
    return ctx.reply('❌ *БАНК LUDIX:* Вы в чёрном списке за неуплату! Кредиты недоступны.', { parse_mode: 'Markdown' })
  }

  if (user.debt > 0) {
    return ctx.reply(`🏦 *БАНК LUDIX:* У вас уже есть активный кредит!\n💵 Ваш долг: *${user.debt}$*\n_Погасите его, прежде чем брать новый._`, { parse_mode: 'Markdown' })
  }

  const creditAmount = user.level * 5000
  const finalDebt = creditAmount * 1.2

  db.prepare(`
    UPDATE users
    SET balance = balance + ?, debt = ?, debtTimer = ?, credits = credits + 1
    WHERE telegramId = ?
  `).run(creditAmount, finalDebt, Date.now(), String(ctx.from.id))

  const updatedUser = getUser(String(ctx.from.id))

  ctx.reply(`
🏦 *КРЕДИТ В LUDIX УСПЕШНО ОДОБРЕН*
━━━━━━━━━━━━━━━━━━━━
💰 Получено на баланс: *+${creditAmount}$*
📉 Сумма к возврату (с учетом %): *${finalDebt}$*
⏳ Срок на погашение: *10 минут*
💵 Ваш баланс: *${updatedUser.balance}$*
━━━━━━━━━━━━━━━━━━━━
_Внимание! Если вы не вернете долг вовремя, банк заблокирует ваш пассивный доход!_
  `, { parse_mode: 'Markdown' })
})

// ЛОГИКА ПОГАШЕНИЯ КРЕДИТА
bot.hears('💵 Погасить Кредит', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')

  if (user.debt === 0) {
    return ctx.reply('🏦 *БАНК LUDIX:* У вас нет активных задолженностей.')
  }

  if (user.balance < user.debt) {
    return ctx.reply(`❌ *БАНК LUDIX:* Недостаточно денег для погашения!\n💵 Ваш долг: *${user.debt}$*\n💰 Ваш баланс: *${user.balance}$*`, { parse_mode: 'Markdown' })
  }

  db.prepare('UPDATE users SET balance = balance - debt, debt = 0, debtTimer = 0, blacklist = 0 WHERE telegramId = ?').run(String(ctx.from.id))
  const updatedUser = getUser(String(ctx.from.id))

  ctx.reply(`
🎉 *КРЕДИТ В LUDIX ПОЛНОСТЬЮ ПОГАШЕН*
━━━━━━━━━━━━━━━━━━━━
✅ Ваш долг обнулен!
🌟 Кредитная история полностью очищена.
💵 Ваш баланс: *${updatedUser.balance}$*
━━━━━━━━━━━━━━━━━━━━
  `, { parse_mode: 'Markdown' })
})


// РАБОТА
// ====================================================================
// РАЗДЕЛ: СИСТЕМА ТРУДОУСТРОЙСТВА LUDIX
// ====================================================================

// ====================================================================
// РАЗДЕЛ: СИСТЕМА ТРУДОУСТРОЙСТВА LUDIX (С ЗАЩИТОЙ ОТ СПАМА)
// ====================================================================
bot.hears('💼 Работа', (ctx) => {
  const user = getUser(String(ctx.from.id), ctx)
  if (!user) return // Смарт-запуск перехватит управление

  const now = Date.now()
  const cooldown = 60000 // 60 секунд кулдауна в миллисекундах
  const timeLeft = cooldown - (now - user.lastWork)

  if (timeLeft > 0) {
    const secondsLeft = Math.ceil(timeLeft / 1000)
    return ctx.reply(`⏳ *ВЫ УСТАЛИ:* Вы не можете работать без остановки!\nОтдохните еще *${secondsLeft} сек.* перед следующей сменой.`, { parse_mode: 'Markdown' })
  }

  // Награда плавно растет с уровнем
  const reward = user.level * 150

  db.prepare(`
    UPDATE users 
    SET balance = balance + ?, xp = xp + 15, lastWork = ? 
    WHERE telegramId = ?
  `).run(reward, now, String(ctx.from.id))

  checkLevelUp(String(ctx.from.id))
  const updatedUser = getUser(String(ctx.from.id))

  ctx.reply(`
💼 *СМЕНА НА РАБОТЕ УСПЕШНО ЗАВЕРШЕНА*
━━━━━━━━━━━━━━━━━━━━
💰 Вы заработали: *+${reward}$*
⭐ Получено опыта: *+15 XP*
💵 Текущий баланс: *${updatedUser.balance}$*
━━━━━━━━━━━━━━━━━━━━
_Следующая смена доступна через 60 секунд!_
  `, { parse_mode: 'Markdown' })
})



// СТАТА

// 5. СТАТИСТИКА ИГРОКА LUDIX
bot.hears('📊 Стата', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')

  ctx.reply(`
📊 *ВАША СТАТИСТИКА LUDIX*
━━━━━━━━━━━━━━━━━━━━
💰 Всего выиграно: *${user.totalWon || 0}$*
💀 Всего проиграно: *${user.totalLost || 0}$*
🎁 Кейсов открыто: *${user.casesOpened || 0}*
🏦 Текущий долг: *${user.debt || 0}$*
📈 Общий профит с кейсов: *${user.allTimeProfit || 0}$*
🔥 Винстрик: *${user.winstreak || 0}*
━━━━━━━━━━━━━━━━━━━━
  `, { parse_mode: 'Markdown' })
})


// 4. МАГАЗИН
// 6. МЕНЮ МАГАЗИНА LUDIX (ПОСТОЯННЫЕ REPLY-КНОПКИ ТОВАРОВ)
bot.hears('🛒 Магазин', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')

  ctx.reply(`
🛒 *ТЕНЕВОЙ МАРКЕТ LUDIX*
━━━━━━━━━━━━━━━━━━━━
💵 Ваш баланс: *${user.balance}$*
📈 Пассивный доход: *${user.income}$/мин*
━━━━━━━━━━━━━━━━━━━━
🎰 *Слот-аппарат «Обезьянки»*
💰 Цена: *3,000$* ｜ Прибыль: *+15$/мин*

  *Откат пит-боссу казино*
💰 Цена: *15,000$* ｜ Прибыль: *+100$/мин*

🕶 *Доля в подпольном катране*
💰 Цена: *75,000$* ｜ Прибыль: *+650$/мин*
━━━━━━━━━━━━━━━━━━━━
_Для покупки бизнеса используйте кнопки внизу экрана!_
  `, Markup.keyboard([
    ['🎰 Купить Аппарат', '🤵‍♂️ Купить Откат'],
    ['🕶 Купить Долю в катране'],
    ['↩️ Назад в меню']
  ]).resize())
})

// ЛОГИКА ПОКУПКИ 1 ТОВАРА
bot.hears('🎰 Купить Аппарат', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')
  if (user.balance < 3000) return ctx.reply('💀 Недостаточно денег! Стоимость слот-аппарата: *3,000$*', { parse_mode: 'Markdown' })

  db.prepare('UPDATE users SET balance = balance - 3000, income = income + 15 WHERE telegramId = ?').run(String(ctx.from.id))
  const updatedUser = getUser(String(ctx.from.id))
  
  ctx.reply(`🎰 Вы успешно купили Слот-аппарат!\n📈 Ваш пассивный доход повышен на *+15$/мин.*\n💵 Текущий баланс: *${updatedUser.balance}$*`, { parse_mode: 'Markdown' })
})

// ЛОГИКА ПОКУПКИ 2 ТОВАРА
bot.hears('🤵‍♂️ Купить Откат', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')
  if (user.balance < 15000) return ctx.reply('💀 Недостаточно денег! Стоимость отката пит-боссу: *15,000$*', { parse_mode: 'Markdown' })

  db.prepare('UPDATE users SET balance = balance - 15000, income = income + 100 WHERE telegramId = ?').run(String(ctx.from.id))
  const updatedUser = getUser(String(ctx.from.id))
  
  ctx.reply(`🤵‍♂️ Вы подкупили пит-босса казино!\n📈 Ваш пассивный доход повышен на *+100$/мин.*\n💵 Текущий баланс: *${updatedUser.balance}$*`, { parse_mode: 'Markdown' })
})

// ЛОГИКА ПОКУПКИ 3 ТОВАРА
bot.hears('🕶 Купить Долю в катране', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')
  if (user.balance < 75000) return ctx.reply('💀 Недостаточно денег! Стоимость доли в катране: *75,000$*', { parse_mode: 'Markdown' })

  db.prepare('UPDATE users SET balance = balance - 75000, income = income + 650 WHERE telegramId = ?').run(String(ctx.from.id))
  const updatedUser = getUser(String(ctx.from.id))
  
  ctx.reply(`🕶 Вы выкупили долю в подпольном катране!\n📈 Ваш пассивный доход повышен на *+650$/мин.*\n💵 Текущий баланс: *${updatedUser.balance}$*`, { parse_mode: 'Markdown' })
})



// 5. ЕЖЕДНЕВНЫЙ БОНУС
// 7. ЕЖЕДНЕВНЫЙ БОНУС LUDIX (ПЕРЕРАБОТАННАЯ НАГРАДА)
bot.hears('🎁 Daily', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')
  
  const now = Date.now()
  if (now - user.lastDaily < 86400000) {
    return ctx.reply('⏳ Ваш Daily бонус еще не восстановился. Он доступен раз в 24 часа!')
  }

  // Динамическая награда: 1000$ + 200$ за каждый уровень
  const reward = 1000 + (user.level * 200)

  db.prepare(
    'UPDATE users SET balance = balance + ?, lastDaily = ? WHERE telegramId = ?'
  ).run(reward, now, String(ctx.from.id))

  const updatedUser = getUser(String(ctx.from.id))

  ctx.reply(`
🎁 *ЕЖЕДНЕВНЫЙ БОНУС ЗАБРАН*
━━━━━━━━━━━━━━━━━━━━
💰 Ваша награда: *+${reward}$*
💵 Новый баланс: *${updatedUser.balance}$*

_(Бонус увеличивается вместе с ростом вашего уровня)_
━━━━━━━━━━━━━━━━━━━━
  `, { parse_mode: 'Markdown' })
})


// КЕЙСЫ

// 8. КЕЙСЫ И ЛУТБОКСЫ LUDIX (ПЕРЕКЛЮЧЕНИЕ НА КНОПКИ ВНИЗУ)
bot.hears('📦 Кейсы', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')

  ctx.reply(`
📦 *КЕЙСЫ И ЛУТБОКСЫ LUDIX*
━━━━━━━━━━━━━━━━━━━━
💵 Ваш баланс: *${user.balance}$*
📊 Открыто кейсов: *${user.casesOpened || 0}*
━━━━━━━━━━━━━━━━━━━━
🍀 Испытайте свою удачу! Вы можете выиграть до х10 от стоимости кейса.

_Выберите кейс для открытия кнопками внизу экрана:_
  `, Markup.keyboard([
    ['🔓 Открыть Обычный Кейс (2,500$)'],
    ['↩️ Назад в меню']
  ]).resize())
})

// ЛОГИКА ОТКРЫТИЯ КЕЙСА С ПОКАДРОВОЙ РУЛЕТКОЙ
bot.hears('🔓 Открыть Обычный Кейс (2,500$)', async (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')
  
  const price = 2500
  if (user.balance < price) {
    return ctx.reply(`💀 Недостаточно денег! Стоимость кейса: ${price}$. Ваш баланс: ${user.balance}$`)
  }

  // АНИМАЦИЯ: Эффект вращения барабана кейса
  const msg = await ctx.reply('📦 *Кейс покупается...* \n🔑 _Замок открыт, рулетка закрутилась..._')

  setTimeout(async () => {
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, '📦 [ 🟦 Rare ｜ 🟩 Uncom ｜ 🟪 Epic ] \n_Рулетка замедляется..._')

    setTimeout(async () => {
      // Математические шансы удержания игрока (в сумме 100)
      const rand = Math.random() * 100
      let winAmount = 0
      let tier = ''

      if (rand < 40) {         // 40% шанс — мелкий утешительный приз (минус для банка)
        winAmount = Math.floor(Math.random() * 800) + 400 // 400$ - 1200$
        tier = '⚪ ОБЫЧНЫЙ СЛУЧАЙ'
      } else if (rand < 75) {  // 35% шанс — почти окупился (небольшой минус)
        winAmount = Math.floor(Math.random() * 1000) + 1400 // 1400$ - 2400$
        tier = '🟢 НЕОБЫЧНЫЙ ИСХОД'
      } else if (rand < 93) {  // 18% шанс — Удвоение (окупился в небольшой плюс)
        winAmount = Math.floor(Math.random() * 1500) + 3000 // 3000$ - 4500$
        tier = '🔵 РЕДКИЙ КУШ'
      } else if (rand < 99) {  // 6% шанс — Крупный выигрыш
        winAmount = Math.floor(Math.random() * 4000) + 6000 // 6000$ - 10000$
        tier = '🟣 ЭПИЧЕСКИЙ ДРОП'
      } else {                 // 1% шанс — СВЕРХДОХОД (ДЖЕКПОТ)
        winAmount = 25000
        tier = '🔥 ЛЕГЕНДАРНЫЙ ДЖЕКПОТ LUDIX'
      }

      const profit = winAmount - price

      // Обновляем баланс, счетчик кейсов и общий профит
      db.prepare(`
        UPDATE users 
        SET balance = balance + ?, casesOpened = casesOpened + 1, allTimeProfit = allTimeProfit + ? 
        WHERE telegramId = ?
      `).run(profit, profit, String(ctx.from.id))

      const updatedUser = getUser(String(ctx.from.id))

      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `
📦 *КЕЙС УСПЕШНО ОТКРЫТ*
━━━━━━━━━━━━━━━━━━━━
Ранг дропа: *${tier}*
💰 Выпало из кейса: *${winAmount}$*

${profit >= 0 ? `📈 Чистый профит: *+${profit}$* 🎉` : `📉 Убыток: *${profit}$*`}
💵 Ваш новый баланс: *${updatedUser.balance}$*
━━━━━━━━━━━━━━━━━━━━
      `, { parse_mode: 'Markdown' })

    }, 800)
  }, 800)
})

// ====================================================================
// ФИНАЛЬНЫЙ РАЗДЕЛ: ПАССИВНЫЙ ДОХОД LUDIX И ЗАПУСК СЕРВЕРА
// ====================================================================

// НАЧИСЛЕНИЕ ДОХОДА (КАЖДЫЕ 5 МИНУТ С УМНОЖЕНИЕМ НА 5)
setInterval(() => {
  const users = db.prepare('SELECT * FROM users').all()

  for (const user of users) {
    const totalIncome = user.income * 5
    db.prepare(
      'UPDATE users SET balance = balance + ? WHERE telegramId = ?'
    ).run(totalIncome, user.telegramId)
  }

  console.log('Пассивный доход LUDIX успешно начислен')
}, 300000)

// АСИНХРОННЫЙ СТАРТ БОТА
async function startBot() {
  try {
    console.log('Попытка запуска бота...')
    await bot.launch()
    console.log('✅ BOT STARTED SUCCESSFULLY')
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ПРИ ЗАПУСКЕ:', error.message)
  }
}

startBot()

// Корректная остановка бота при перезапуске сервера хостинга
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

// ВЕБ-СЕРВЕР ДЛЯ ОБХОДА БЛОКИРОВКИ ПОРТОВ RENDER
const http = require('http')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('LUDIX Bot is running\n')
})

const PORT = process.env.PORT || 10000

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
