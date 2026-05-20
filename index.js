const { Telegraf, Markup } = require('telegraf')
const Database = require('better-sqlite3')
require('dotenv').config()

// Чистая инициализация без лишних скобок
const token = process.env.BOT_TOKEN || '8721680626:AAFuGPHaUhZfXQeRQsEQXcNvYG5uDzWIG5s'
const bot = new Telegraf(token)
const db = new Database('game.db')
// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ОБЯЗАТЕЛЬНО ТУТ)
function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE telegramId = ?').get(id)
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
// ==========================================

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
  totalLost INTEGER DEFAULT 0
)
`).run()

// Безопасное добавление колонок для старых пользователей (без кучи блоков try/catch)
const columns = [
  'xp DEFAULT 0', 
  'level DEFAULT 1', 
  'winstreak DEFAULT 0', 
  'totalWon DEFAULT 0', 
  'totalLost DEFAULT 0',
  'casesOpened INTEGER DEFAULT 0',
  'debt INTEGER DEFAULT 0',
  'debtTimer INTEGER DEFAULT 0',
  'blacklist INTEGER DEFAULT 0',
  'credits INTEGER DEFAULT 0',
  'allTimeProfit INTEGER DEFAULT 0'
]

for (const col of columns) {
  try { db.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run() } catch (e) {}
}

// START — Постоянное меню на кнопках
bot.start((ctx) => {
  const id = String(ctx.from.id)
  const username = ctx.from.username || 'player'

  createUser(id, username)

  ctx.reply(
    '💸 ДОБРО ПОЖАЛОВАТЬ В LUDIX',
   Markup.keyboard([
  ['💰 Профиль', '🎰 Казино'],
  ['🛒 Магазин', '🎁 Daily'],
  ['🏆 Топ', '🏦 Кредит'],
  ['💳 Погасить', '📊 Стата'],
  ['🎁 Кейсы']
]).resize()
  )
})

// ОБРАБОТКА ПОСТОЯННЫХ КНОПОК (МЕНЮ)

// 1. ПРОФИЛЬ
bot.hears('💰 Профиль', (ctx) => {
  const user = getUser(String(ctx.from.id))

  ctx.reply(`
👤 @${user.username}

💵 Баланс: ${user.balance}$
📈 Доход: ${user.income}$/мин

🏆 Уровень: ${user.level}
⭐ XP: ${user.xp} / ${user.level * 100}
🔥 Винстрик: ${user.winstreak}
  `)
})

// 2. КАЗИНО (Инлайн кнопки для под-меню игр)
bot.hears('🎰 Казино', (ctx) => {
  ctx.reply(
    '🎰 КАЗИНО',
    Markup.inlineKeyboard([
      [Markup.button.callback('🪙 Coinflip 1000$', 'coinflip')],
      [Markup.button.callback('🎲 Slots 1000$', 'slots')]
    ])
  )
})

// 3. ТОП
bot.hears('🏆 Топ', (ctx) => {
  const users = db.prepare(
    'SELECT * FROM users ORDER BY balance DESC LIMIT 10'
  ).all()

  let text = '🏆 *ТОП-10 ИГРОКОВ DOPELINE:*\n\n'
  
  users.forEach((user, index) => {
    text += `${index + 1}. @${user.username} — *${user.balance}$*\n`
  })

  ctx.reply(text, { parse_mode: 'Markdown' })
})
// КРЕДИТ

bot.hears('🏦 Кредит', (ctx) => {
  const user = getUser(String(ctx.from.id))

  if(user.blacklist === 1) {
    return ctx.reply('🚫 Банк внес тебя в черный список')
  }

  if(user.debt > 0) {
    return ctx.reply(`
💀 У тебя уже есть кредит

📉 Долг: ${user.debt}$

Верни сначала его
    `)
  }

  const creditAmount = 10000
  const finalDebt = 15000

    db.prepare(`
    UPDATE users
    SET
      balance = balance + ?,
      debt = ?,
      debtTimer = ?,
      credits = credits + 1
    WHERE telegramId = ?
  `).run(
    creditAmount,
    finalDebt,
    Date.now(),
    String(ctx.from.id)
  )


  ctx.reply(`
🏦 КРЕДИТ ОДОБРЕН

💵 Получено: ${creditAmount}$

📉 Вернуть нужно: ${finalDebt}$

⏳ Срок: 24 часа

🤡 удачи не слить это за 4 минуты
  `)
})
bot.hears('💳 Погасить', (ctx) => {
  const user = getUser(String(ctx.from.id))

  if(user.debt <= 0) {
    return ctx.reply('✅ У тебя нет долгов')
  }

  if(user.balance < user.debt) {
    return ctx.reply(`
💀 Недостаточно денег

📉 Долг: ${user.debt}$
    `)
  }

  db.prepare(`
    UPDATE users
    SET
      balance = balance - debt,
      debt = 0
    WHERE telegramId = ?
  `).run(String(ctx.from.id))

  ctx.reply(`
✅ КРЕДИТ ПОГАШЕН

🏦 Банк снова тебе доверяет
  `)
})
// СТАТА

// СТАТА
bot.hears('📊 Стата', (ctx) => {
  const user = getUser(String(ctx.from.id))

  ctx.reply(`
📊 СТАТИСТИКА

💰 Всего выиграно: ${user.totalWon}$
💀 Всего проиграно: ${user.totalLost}$
🎁 Кейсов открыто: ${user.casesOpened || 0}
🏦 Текущий долг: ${user.debt || 0}$
📈 Общий профит с кейсов: ${user.allTimeProfit || 0}$
🔥 Винстрик: ${user.winstreak}
  `)
})

// 4. МАГАЗИН
// НАЙДИТЕ И ЗАМЕНИТЕ В bot.hears('🛒 Магазин', ...)
bot.hears('🛒 Магазин', (ctx) => {
  ctx.reply(
    '🛒 МАГАЗИН БИЗНЕСА\n\nИнвестируйте в пассивный доход:',
    Markup.inlineKeyboard([
      [Markup.button.callback('💻 Ноутбук (+5$/мин) — 1,500$', 'buy_pc')],
      [Markup.button.callback('⛏ Криптоферма (+25$/мин) — 7,500$', 'buy_farm')]
    ])
  )
})

// ОБНОВИТЕ СТОИМОСТЬ В АНИМАЦИИ ПОКУПКИ (buy_pc и buy_farm)
bot.action('buy_pc', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (user.balance < 1500) return ctx.reply('💀 Недостаточно денег. Стоимость: 1500$')
  db.prepare('UPDATE users SET balance = balance - 1500, income = income + 5 WHERE telegramId = ?').run(String(ctx.from.id))
  ctx.reply('💻 Вы купили ноутбук! Доход повышен.')
})

bot.action('buy_farm', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (user.balance < 7500) return ctx.reply('💀 Недостаточно денег. Стоимость: 7500$')
  db.prepare('UPDATE users SET balance = balance - 7500, income = income + 25 WHERE telegramId = ?').run(String(ctx.from.id))
  ctx.reply('⛏ Вы купили криптоферму! Доход существенно повышен.')
})


// 5. ЕЖЕДНЕВНЫЙ БОНУС
// НАЙДИТЕ И ЗАМЕНИТЕ В bot.hears('🎁 Daily', ...)
bot.hears('🎁 Daily', (ctx) => {
  const user = getUser(String(ctx.from.id))
  if (!user) return ctx.reply('Сначала введи /start')
  
  const now = Date.now()
  if (now - user.lastDaily < 86400000) {
    return ctx.reply('⏳ Daily бонус можно забрать раз в 24 часа!')
  }

  // Динамическая награда зависит от уровня
  const reward = 1000 + (user.level * 200)

  db.prepare(
    'UPDATE users SET balance = balance + ?, lastDaily = ? WHERE telegramId = ?'
  ).run(reward, now, String(ctx.from.id))

  ctx.reply(`🎁 Вы забрали ежедневный бонус!\n💰 Награда: ${reward}$ (бонус увеличивается с ростом уровня)`)
})

// КЕЙСЫ

bot.hears('🎁 Кейсы', (ctx) => {
  ctx.reply(
    '🎁 ВЫБЕРИ КЕЙС',
    Markup.inlineKeyboard([
      [Markup.button.callback('📦 Обычный — 2500$', 'case_normal')],
      [Markup.button.callback('🔥 Рискованный — 10000$', 'case_risky')],
      [Markup.button.callback('💎 Легендарный — 50000$', 'case_legend')]
    ])
  )
})

// ОБРАБОТКА ДЕЙСТВИЙ (ИНЛАЙН-КНОПКИ ИГР И ПОКУПОК)

// ПОКУПКА ПК
bot.action('buy_pc', (ctx) => {
  const user = getUser(String(ctx.from.id))

  if (user.balance < 1000) {
    return ctx.reply('💀 Недостаточно денег')
  }

  db.prepare(
    'UPDATE users SET balance = balance - 1000, income = income + 5 WHERE telegramId = ?'
  ).run(String(ctx.from.id))

  ctx.reply('💻 Ты купил ноутбук')
})

// ПОКУПКА КРИПТОФЕРМЫ
bot.action('buy_farm', (ctx) => {
  const user = getUser(String(ctx.from.id))

  if (user.balance < 5000) {
    return ctx.reply('💀 Недостаточно денег')
  }

  db.prepare(
    'UPDATE users SET balance = balance - 5000, income = income + 20 WHERE telegramId = ?'
  ).run(String(ctx.from.id))

  ctx.reply('⛏ Ты купил криптоферму')
})

// ИГРА СOINFLIP
bot.action('coinflip', (ctx) => {
  const user = getUser(String(ctx.from.id))

  if (user.balance < 1000) {
    return ctx.reply('💀 Недостаточно денег')
  }

  const win = Math.random() > 0.5

  if (win) {
    db.prepare(`
      UPDATE users 
      SET balance = balance + 1000, xp = xp + 15, winstreak = winstreak + 1, totalWon = totalWon + 1000 
      WHERE telegramId = ?
    `).run(String(ctx.from.id))

    const leveledUp = checkLevelUp(String(ctx.from.id))
    
    if (leveledUp) {
      ctx.reply('🎉 ОГО! Ты повысил свой уровень! Получено +10 000$!')
    }
    ctx.reply('🤑 Ты выиграл 1000$')
  } else {
    db.prepare(`
      UPDATE users 
      SET balance = balance - 1000, xp = xp + 5, winstreak = 0, totalLost = totalLost + 1000 
      WHERE telegramId = ?
    `).run(String(ctx.from.id))

    const loseMessages = [
  '💀 Ты проиграл',
  '🤡 Ну вот и зарплата ушла',
  '📉 Инвестор из тебя так себе',
  '💸 Казино говорит спасибо',
  '🪦 press F'
]

ctx.reply(
  loseMessages[Math.floor(Math.random() * loseMessages.length)]
)

  }

})
// ИГРА SLOTS
bot.action('slots', (ctx) => {
  const user = getUser(String(ctx.from.id))

  if (user.balance < 1000) {
    return ctx.reply('💀 Недостаточно денег')
  }

  const symbols = ['🍒', '💎', '🔥', '🍋']

  const a = symbols[Math.floor(Math.random() * symbols.length)]
  const b = symbols[Math.floor(Math.random() * symbols.length)]
  const c = symbols[Math.floor(Math.random() * symbols.length)]

  const result = `${a} ${b} ${c}`

  if (a === b && b === c) {
    db.prepare(
      'UPDATE users SET balance = balance + 5000 WHERE telegramId = ?'
    ).run(String(ctx.from.id))

    ctx.reply(`
🎰 ${result}

🤑 JACKPOT +5000$

🚨 HUGE WIN
`)
  } else {
    db.prepare(
      'UPDATE users SET balance = balance - 1000 WHERE telegramId = ?'
    ).run(String(ctx.from.id))

    ctx.reply(`🎰 ${result}\n\n💀 Проигрыш`) 
  }
})
// ОБЫЧНЫЙ КЕЙС

// ПРИМЕР ДЛЯ КЕЙСА (Стоимость: 2500$)
bot.action('open_case', (ctx) => {
  const user = getUser(String(ctx.from.id))
  const price = 2500
  if (user.balance < price) return ctx.reply('💀 Недостаточно денег для открытия кейса!')

  // Математические шансы (в сумме 100)
  // Игрок чаще получает "около-окупаемые" призы, создавая иллюзию близости к победе
  const rand = Math.random() * 100

  let winAmount = 0
  let tier = ''

  if (rand < 40) {         // 40% шанс - мелкий утешительный приз (минус для банка)
    winAmount = Math.floor(Math.random() * 800) + 400 // 400$ - 1200$
    tier = '⚪ ОБЫЧНЫЙ'
  } else if (rand < 75) {  // 35% шанс - почти окупился (небольшой минус)
    winAmount = Math.floor(Math.random() * 1000) + 1400 // 1400$ - 2400$
    tier = '🟢 НЕОБЫЧНЫЙ'
  } else if (rand < 93) {  // 18% шанс - Удвоение (окупился в небольшой плюс)
    winAmount = Math.floor(Math.random() * 1500) + 3000 // 3000$ - 4500$
    tier = '🔵 РЕДКИЙ'
  } else if (rand < 99) {  // 6% шанс - Крупный выигрыш
    winAmount = Math.floor(Math.random() * 4000) + 6000 // 6000$ - 10000$
    tier = '🟣 ЭПИЧЕСКИЙ'
  } else {                 // 1% шанс - СВЕРХДОХОД (ДЖЕКПОТ)
    winAmount = 25000
    tier = '🔥 ЛЕГЕНДАРНЫЙ ДЖЕКПОТ'
  }

  const profit = winAmount - price

  db.prepare(`
    UPDATE users 
    SET balance = balance + ?, casesOpened = casesOpened + 1, allTimeProfit = allTimeProfit + ? 
    WHERE telegramId = ?
  `).run(profit, profit, String(ctx.from.id))

  ctx.reply(`📦 Вы открыли кейс за ${price}$\n\nРанг: ${tier}\n💰 Выпало: ${winAmount}$\n${profit >= 0 ? `📈 Чистый профит: +${profit}$` : `📉 Убыток: ${profit}$`}`)
})

// ПРОСРОЧКА КРЕДИТА

setInterval(() => {

  const users = db.prepare('SELECT * FROM users').all()

  for(const user of users) {

    if(user.debt > 0) {

      const passed = Date.now() - user.debtTimer

      // 24 часа
      if(passed >= 86400000) {

        // если денег хватает — автоматическое списание
        if(user.balance >= user.debt) {

          db.prepare(`
            UPDATE users
            SET
              balance = balance - debt,
              debt = 0
            WHERE telegramId = ?
          `).run(user.telegramId)

        } else {

          // штраф
          db.prepare(`
            UPDATE users
            SET
              income = income - 5,
              blacklist = 1
            WHERE telegramId = ?
          `).run(user.telegramId)

        }

      }

    }

  }

}, 60000)
// PASSIVE INCOME
// НАЙДИТЕ И ЗАМЕНИТЕ ИНТЕРВАЛ В САМОМ КОНЦЕ ФАЙЛА
// Изменяем интервал на 5 минут (300000 мс), но доход умножаем на 5
setInterval(() => {
  const users = db.prepare('SELECT * FROM users').all()
  for (const user of users) {
    const totalIncome = user.income * 5
    db.prepare(
      'UPDATE users SET balance = balance + ? WHERE telegramId = ?'
    ).run(totalIncome, user.telegramId)
  }
  console.log('Пассивный доход начислен (каждые 5 минут)')
}, 300000)


async function startBot() {
  try {
    console.log('Попытка запуска бота...')
    await bot.launch()
    console.log('✅ BOT STARTED SUCCESSFULLY')
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ПРИ ЗАПУСКЕ:', error.message)
    console.error(error)
  }
}

startBot()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

// ВЕБ-СЕРВЕР ДЛЯ RENDER
const http = require('http')
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Bot is running\n')
})
const PORT = process.env.PORT || 10000
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
