const { puppeteerSetting, checkStreamInterval } = require('./config/config.js')
const { twitch } = require('./config/announce')
const { startToMonitor, timeAnnounce } = twitch
const { helper } = require('./util/helper')
const { announcer } = helper
const app = require('./app')
const puppeteer = require('puppeteer-core');

let recursionTime = 1

function startApp(browser) {
  return new Promise((resolve, reject) => {
    try {
      const errorTimer = setTimeout(() => {
        helper.announcer(twitch.errorOccurred, 'warn')
      }, checkStreamInterval * 2);

      setTimeout(async () => {
        announcer(timeAnnounce(recursionTime++), 'time')
        await app(browser)
        clearTimeout(errorTimer)
        resolve()
      }, checkStreamInterval)
    } catch (error) {
      console.error(error)
      reject()
    }
  })
}

(async () => {
  announcer(startToMonitor)
  announcer(timeAnnounce(recursionTime++), 'time')
  const browser = await puppeteer.launch(puppeteerSetting);
  // 用來VOD下載結束後確認時間長度
  global.browser = browser
  await app(browser)
  while (true) {
    await startApp(browser)
    let used = process.memoryUsage();
    for (let key in used) {
      console.log(`${key} ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
    }
    used = null
  }
})()