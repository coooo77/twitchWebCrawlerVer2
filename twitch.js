const { puppeteerSetting, checkStreamInterval } = require('./config/config.js')
const { twitch } = require('./config/announce')
const { startToMonitor, timeAnnounce } = twitch
const { announcer } = require('./util/helper')
const app = require('./app')
const puppeteer = require('puppeteer-core');
(async () => {
  announcer(startToMonitor)
  let count = 1
  announcer(timeAnnounce(count++), 'time')
  const browser = await puppeteer.launch(puppeteerSetting);
  await app(browser)
  setInterval(async function () {
    announcer(timeAnnounce(count++), 'time')
    await app(browser)
  }, checkStreamInterval)
})()