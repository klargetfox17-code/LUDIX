const { Telegraf, Markup } = require('telegraf')
const Database = require('better-sqlite3')
require('dotenv').config()

// Чистая инициализация без лишних скобок
const token = process.env.BOT_TOKEN || '8721680626:AAFuGPHaUhZfXQeRQsEQXcNvYG5uDzWIG5s'
const bot = new Telegraf(token)
const db = new Database('game.db')

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

function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE telegramId = ?').get(id)
}

function createUser(id, username) {
  db.prepare(
    'INSERT OR IGNORE INTO users (telegramId, username) VALUES (?, ?)'
  ).run(id, username)
} // <-- ИСПРАВЛЕНО: Закрыли функцию createUser перед объявлением следующей

function checkLevelUp(id) {
  const user = getUser(id)
  const needXP = user.level * 100

  if (user.xp >= needXP) {
    db.prepare(
      'UPDATE users SET level = level + 1, xp = 0, balance = balance + 10000 WHERE telegramId = ?'
    ).run(id)
    return true
  }
  return false
}

// START
bot.start((ctx) => {
  const id = String(ctx.from.id)
  const username = ctx.from.username || 'player'

  createUser(id, username)

  ctx.reply(
    '💸 ДОБРО ПОЖАЛОВАТЬ В DOPELINE',
    Markup.keyboard([
      ['💰 Профиль', '🎰 Казино'],
      ['🛒 Магазин', '🎁 Daily'],
      ['🏆 Топ']
    ]).resize() // .resize() делает кнопки компактными и аккуратными под размер экрана
  )
})

// LEADERBOARD
bot.action('top', (ctx) => {
  const users = db.prepare(
    'SELECT * FROM users ORDER BY balance DESC LIMIT 10'
  ).all()

  let text = '🏆 *ТОП-10 ИГРОКОВ DOPELINE:*\n\n'
  
  users.forEach((user, index) => {
    text += `${index + 1}. @${user.username} — *${user.balance}$*\n`
  })

  ctx.reply(text, { parse_mode: 'Markdown' })
})

// PROFILE
bot.hears('💰 Профиль', (ctx) => {
  const user = getUser(String(ctx.from.id))
  // ... ваш старый код профиля
})

// Переделываем CASINO
bot.hears('🎰 Казино', (ctx) => {
  ctx.reply(
    '🎰 КАЗИНО',
    Markup.inlineKeyboard([ // Кнопки ВНУТРИ казино (игр) можно оставить инлайновыми!
      [Markup.button.callback('🪙 Coinflip 1000$', 'coinflip')],
      [Markup.button.callback('🎲 Slots 1000$', 'slots')]
    ])
  )
})

// Переделываем TOP
bot.hears('🏆 Топ', (ctx) => {
  // ... ваш старый код топа
})

// Переделываем SHOP
bot.hears('🛒 Магазин', (ctx) => {
  // ... ваш старый код магазина
})

// Переделываем DAILY
bot.hears('🎁 Daily', (ctx) => {
  // ... ваш старый код ежедневной награды
})

// SHOP
bot.action('shop', (ctx) => {
  ctx.reply(
    '🛒 МАГАЗИН',
    Markup.inlineKeyboard([
      [Markup.button.callback('💻 Ноутбук (+5$/мин) — 1000$', 'buy_pc')],
      [Markup.button.callback('⛏ Криптоферма (+20$/мин) — 5000$', 'buy_farm')]
    ])
  )
})

// BUY PC
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

// BUY FARM
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

// DAILY
bot.action('daily', (ctx) => {
  const user = getUser(String(ctx.from.id))
  const now = Date.now()

  if (now - user.lastDaily < 86400000) {
    return ctx.reply('⏳ Daily уже забран')
  }

  db.prepare(
    'UPDATE users SET balance = balance + 5000, lastDaily = ? WHERE telegramId = ?'
  ).run(now, String(ctx.from.id))

  ctx.reply('🎁 Ты получил 5000$')
})

// CASINO
bot.action('casino', (ctx) => {
  ctx.reply(
    '🎰 КАЗИНО',
    Markup.inlineKeyboard([
      [Markup.button.callback('🪙 Coinflip 1000$', 'coinflip')],
      [Markup.button.callback('🎲 Slots 1000$', 'slots')]
    ])
  )
})

// COINFLIP
bot.action('coinflip', (ctx) => {
  const user = getUser(String(ctx.from.id))

  if (user.balance < 1000) {
    return ctx.reply('💀 Недостаточно денег')
  }

  const win = Math.random() > 0.5

  if (win) {
    // ИСПРАВЛЕНО: Объединили два запроса обновления в один быстрый
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

    ctx.reply('💀 Ты проиграл')
  }
})

// SLOTS
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

    ctx.reply(`🎰 ${result}\n\n🤑 JACKPOT +5000$`)
  } else {
    db.prepare(
      'UPDATE users SET balance = balance - 1000 WHERE telegramId = ?'
    ).run(String(ctx.from.id))

    ctx.reply(`🎰 ${result}\n\n💀 Проигрыш`) 
  }
})

// PASSIVE INCOME
setInterval(() => {
  const users = db.prepare('SELECT * FROM users').all()

  for (const user of users) {
    db.prepare(
      'UPDATE users SET balance = balance + income WHERE telegramId = ?'
    ).run(user.telegramId)
  }

  console.log('income added')
}, 60000)

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
