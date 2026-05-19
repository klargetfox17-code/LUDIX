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
  lastDaily INTEGER DEFAULT 0
)
`).run()
function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE telegramId = ?').get(id)
}

function createUser(id, username) {
  db.prepare(
    'INSERT OR IGNORE INTO users (telegramId, username) VALUES (?, ?)'
  ).run(id, username)
}
// START

bot.start((ctx) => {
  const id = String(ctx.from.id)
  const username = ctx.from.username || 'player'

  createUser(id, username)

  ctx.reply(
    '💸 ДОБРО ПОЖАЛОВАТЬ В DOPELINE',
    Markup.inlineKeyboard([
      [Markup.button.callback('💰 Профиль', 'profile')],
      [Markup.button.callback('🎰 Казино', 'casino')],
      [Markup.button.callback('🛒 Магазин', 'shop')],
      [Markup.button.callback('🎁 Daily', 'daily')]
    ])
  )
})
// PROFILE

bot.action('profile', (ctx) => {
  const user = getUser(String(ctx.from.id))

  ctx.reply(`
👤 @${user.username}

💵 Баланс: ${user.balance}$
📈 Доход: ${user.income}$/мин
  `)
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

  if(user.balance < 1000) {
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

  if(user.balance < 5000) {
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

  if(now - user.lastDaily < 86400000) {
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

  if(user.balance < 1000) {
    return ctx.reply('💀 Недостаточно денег')
  }

  const win = Math.random() > 0.5

  if(win) {
    db.prepare(
      'UPDATE users SET balance = balance + 1000 WHERE telegramId = ?'
    ).run(String(ctx.from.id))

    ctx.reply('🤑 Ты выиграл 1000$')
  } else {
    db.prepare(
      'UPDATE users SET balance = balance - 1000 WHERE telegramId = ?'
    ).run(String(ctx.from.id))

    ctx.reply('💀 Ты проиграл')
  }
})
// SLOTS

bot.action('slots', (ctx) => {
  const user = getUser(String(ctx.from.id))

  if(user.balance < 1000) {
    return ctx.reply('💀 Недостаточно денег')
  }

  const symbols = ['🍒', '💎', '🔥', '🍋']

  const a = symbols[Math.floor(Math.random() * symbols.length)]
  const b = symbols[Math.floor(Math.random() * symbols.length)]
  const c = symbols[Math.floor(Math.random() * symbols.length)]

  const result = `${a} ${b} ${c}`

  if(a === b && b === c) {
    db.prepare(
      'UPDATE users SET balance = balance + 5000 WHERE telegramId = ?'
    ).run(String(ctx.from.id))

    ctx.reply(`🎰 ${result}

🤑 JACKPOT +5000$`)
  } else {
    db.prepare(
      'UPDATE users SET balance = balance - 1000 WHERE telegramId = ?'
    ).run(String(ctx.from.id))

    ctx.reply(`🎰 ${result}

💀 Проигрыш`) 
  }
})
// PASSIVE INCOME

setInterval(() => {
  const users = db.prepare('SELECT * FROM users').all()

  for(const user of users) {
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

// Корректная остановка бота при перезапуске сервера
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
const http = require('http')
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Bot is running\n')
})
const PORT = process.env.PORT || 10000
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})