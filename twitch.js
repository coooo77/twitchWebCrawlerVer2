const { puppeteerSetting, checkStreamInterval } = require('./config/config.js')
const { twitch } = require('./config/announce')
const { startToMonitor, timeAnnounce } = twitch
const { helper } = require('./util/helper')
const { announcer, debuglog } = helper
const app = require('./app')
const puppeteer = require('puppeteer-core');

let recursionTime = 1

function startApp(browser) {
  return new Promise((resolve, reject) => {
    try {
      const errorTimer = setTimeout(() => {
        announcer(twitch.errorOccurred, 'warn')
        debuglog('startApp', 'Start app fail')
        reject()
      }, ((5 * 60 * 1000) + checkStreamInterval));

      setTimeout(async () => {
        announcer(timeAnnounce(recursionTime++), 'time')
        await app(browser)
        clearTimeout(errorTimer)
        resolve()
      }, checkStreamInterval)
    } catch (error) {
      announcer(twitch.errorOccurred, 'warn')
      debuglog('startApp', error.message)
      reject()
    }
  })
}

async function mainProcess() {
  announcer(startToMonitor)
  announcer(timeAnnounce(recursionTime++), 'time')
  try {
    await app(global.browser)
    while (true) {
      await startApp(global.browser)
      let used = process.memoryUsage();
      for (let key in used) {
        console.log(`${key} ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
      }
      used = null
    }
  } catch (error) {
    return mainProcess()
  }
}

async function startTwitch() {
  global.browser = global.browser || await puppeteer.launch(puppeteerSetting)
  mainProcess()
}

startTwitch()