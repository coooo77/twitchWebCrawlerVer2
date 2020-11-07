const { puppeteerSetting, url } = require('./config/config')
const { login } = require('./config/domSelector')
const { app } = require('./config/announce')
const helper = require('./util/helper')
require('dotenv').config()
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch(puppeteerSetting);
  const page = await browser.newPage();
  try {
    await page.goto(url.twitch, { waitUntil: 'domcontentloaded' });
    await helper.wait(2000)
    // 檢查是否需要登入
    const facebookBtn = await page.$(login.facebookBtn)
    // await page.screenshot({ path: 'facebookBtn.png' });
    if (facebookBtn) {
      helper.announcer(app.startToLogin)
      // 開始登入
      const { account, password } = await helper.getAccountAndPassword()
      await helper.login(page, account, password)
      await helper.wait(2000)
      //驗證SMS
      const confirmSMSBtn = await page.$(login.confirmSMSBtn)
      if (confirmSMSBtn) {
        await helper.verifySMS(page)
      }
      await helper.clickAndNavigate(page, login.confirmSMSBtn, 2000)
    }

    // await page.screenshot({ path: 'homePage.png' });
    await helper.scrollDownUntilCanNot(page)
    // 取得實況主英文ID與實況類型
    const onlineStreamsData = await helper.getOnlineStreamsData(page)
    console.log('onlineStreamsData', onlineStreamsData)
    console.log('Done')
  } catch (error) {
    console.error(error)
  } finally {
    await page.close();
    await browser.close()
  }
})()
