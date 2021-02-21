const { url, checkDiskSpaceAction } = require('./config/config')
const { login } = require('./config/domSelector')
const { app } = require('./config/announce')
const helper = require('./util/helper')
require('dotenv').config()

module.exports = async (browser) => {
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

    // 檢查硬碟空間
    if (checkDiskSpaceAction.isActive) {
      const checkFreeDiskSpace = app.recordAction.checkFreeDiskSpace
      helper.announcer(checkFreeDiskSpace.info)
      const isDiskSpaceEnough = await helper.checkDiskSpace()
      if (isDiskSpaceEnough) {
        helper.announcer(checkFreeDiskSpace.StartRecord)
      } else {
        helper.announcer(checkFreeDiskSpace.stopRecord)
        return
      }
    }

    // 開始錄影
    // await page.screenshot({ path: 'homePage.png' });
    // ---------------------------------------------------------
    // [TODO]:需要正確取得高度的算法
    await helper.scrollDownUntilCanNot(page)
    await helper.wait(1000)
    await helper.scrollDownUntilCanNot(page)
    // ---------------------------------------------------------
    // 取得實況主英文ID與實況類型
    const onlineStreamsData = await helper.getOnlineStreamsData(page)

    // 檢查是否有實況主下線，是的話把isRecording改為false
    const [isStreaming, usersData, vodRecord] = await Promise.all([
      helper.getJSObjData('./model/isStreaming.json'),
      helper.getJSObjData('./model/usersData.json'),
      helper.getJSObjData('./model/vodRecord.json'),
    ])
    await helper.checkLivingChannel(onlineStreamsData, isStreaming, usersData, vodRecord)

    // 開始錄影
    await helper.startToRecordStream(onlineStreamsData, isStreaming, usersData, vodRecord, __dirname, page)


    // 下載指定時間下載的VOD
    if (vodRecord.queue.length !== 0) {
      // await?
      await helper.startToRecordVOD(vodRecord)
    }

  } catch (error) {
    console.error(error)
  } finally {
    await page.close();
    // await browser.close()
  }
}
