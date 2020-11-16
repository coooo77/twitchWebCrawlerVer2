const { puppeteerSetting, checkStreamInterval } = require('./config/config.js')
const { twitch } = require('./config/announce')
const { startToMonitor, timeAnnounce } = twitch
const { announcer } = require('./util/helper')
const app = require('./app')
const puppeteer = require('puppeteer-core');

function runningApp(count, browser) {
  return new Promise((resolve, reject) => {
    try {
      let test = setInterval(async function () {
        announcer(timeAnnounce(count++), 'time')
        await app(browser)
        if (count === 1000) {
          clearInterval(test)
          test = null
          resolve(count)
        }
      }, checkStreamInterval)
    } catch (error) {
      console.log(error)
      reject()
    }
  })
}

(async () => {
  announcer(startToMonitor)
  let count = 1
  announcer(timeAnnounce(count++), 'time')
  const browser = await puppeteer.launch(puppeteerSetting);
  await app(browser)
  while (true) {
    count = await runningApp(count, browser)
  }
})()